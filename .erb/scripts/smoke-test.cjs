const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const debugPort = Number(process.env.SMOKE_DEBUG_PORT || 9335);
const windows = process.platform === 'win32';
const build = spawnSync(windows ? 'npm.cmd' : 'npm', ['run', 'build'], {
	encoding: 'utf8',
});
if (build.stdout) process.stdout.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);
if (build.error || build.status !== 0) {
	throw build.error || new Error(`npm run build exited with ${build.status}`);
}

const electronPath = require('electron');
const child = spawn(
	electronPath,
	[
		'release/app/dist/main/main.js',
		`--remote-debugging-port=${debugPort}`,
		...(process.platform === 'linux'
			? ['--ozone-platform=x11', '--no-sandbox']
			: []),
	],
	{
		detached: !windows,
		shell: windows,
		env: {
			...process.env,
			NODE_ENV: 'production',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	},
);
let output = '';
let exited = false;
let socket;
child.stdout.on('data', (data) => {
	output += data;
});
child.stderr.on('data', (data) => {
	output += data;
});
child.on('exit', () => {
	exited = true;
});
child.on('error', (error) => {
	output += error.stack;
	exited = true;
});

async function waitFor(check, description) {
	const deadline = Date.now() + 120_000;
	while (Date.now() < deadline) {
		if (exited) throw new Error(`npm start exited before ${description}`);
		const value = await check();
		if (value) return value;
		await delay(250);
	}
	throw new Error(`Timed out waiting for ${description}`);
}

async function main() {
	const target = await waitFor(async () => {
		try {
			const response = await fetch(
				`http://127.0.0.1:${debugPort}/json/list`,
			);
			const targets = await response.json();
			return targets.find(
				(entry) =>
					entry.type === 'page' && entry.url.startsWith('file://'),
			);
		} catch {
			return null;
		}
	}, 'Electron renderer');

	socket = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true });
		socket.addEventListener('error', reject, { once: true });
	});
	let id = 0;
	const requests = new Map();
	const exceptions = [];
	socket.addEventListener('message', ({ data }) => {
		const message = JSON.parse(data);
		if (message.method === 'Runtime.exceptionThrown')
			exceptions.push(message.params);
		if (requests.has(message.id)) {
			requests.get(message.id)(message);
			requests.delete(message.id);
		}
	});
	function send(method, params = {}) {
		id += 1;
		const requestId = id;
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				requests.delete(requestId);
				reject(new Error(`Timed out: ${method}`));
			}, 15_000);
			requests.set(requestId, (message) => {
				clearTimeout(timeout);
				if (message.error || message.result?.exceptionDetails) {
					reject(new Error(JSON.stringify(message)));
				} else resolve(message.result);
			});
			socket.send(JSON.stringify({ id: requestId, method, params }));
		});
	}
	async function evaluate(expression) {
		const result = await send('Runtime.evaluate', {
			expression,
			awaitPromise: true,
			returnByValue: true,
		});
		return result.result.value;
	}
	await send('Runtime.enable');
	await waitFor(
		() =>
			evaluate(
				'document.querySelector("h1")?.textContent === "Media workflow" && typeof window.mediaApi?.clearSelection === "function"',
			),
		'media workflow and preload API',
	);
	assert.deepEqual(
		JSON.parse(
			await evaluate(
				'JSON.stringify(Object.keys(window.mediaApi).sort())',
			),
		),
		[
			'abortExtraction',
			'chooseOutput',
			'clearSelection',
			'inspectDroppedMedia',
			'onProgress',
			'revealOutput',
			'selectMedia',
			'startExtraction',
		],
	);
	assert.equal(await evaluate('typeof window.require'), 'undefined');
	assert.equal(
		await evaluate(
			'window.mediaApi.clearSelection().then(() => "media:clear IPC passed")',
		),
		'media:clear IPC passed',
	);
	assert.deepEqual(exceptions, []);
	console.log(
		'Electron startup passed: migrated renderer, secure media API, main-process IPC, and no renderer exceptions.',
	);
}

main()
	.finally(async () => {
		socket?.close();
		if (windows) {
			spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
		} else if (child.pid) {
			for (const signal of ['SIGTERM', 'SIGKILL']) {
				try {
					process.kill(-child.pid, signal);
				} catch (error) {
					if (error.code !== 'ESRCH') throw error;
				}
				if (signal === 'SIGTERM') await delay(1000);
			}
		}
	})
	.catch((error) => {
		console.error(error);
		console.error(output);
		process.exitCode = 1;
	});
