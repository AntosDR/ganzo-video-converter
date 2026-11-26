const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron, expect } = require('playwright/test');
const ffmpegStatic = require('ffmpeg-static-electron');

const ffmpegPath =
	typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.path;
const projectRoot = path.resolve(__dirname, '../..');

async function createFixture(directory, durationSeconds = 4) {
	const mediaPath = path.join(directory, 'fixture.mp4');
	execFileSync(
		ffmpegPath,
		[
			'-hide_banner',
			'-loglevel',
			'error',
			'-y',
			'-f',
			'lavfi',
			'-i',
			'testsrc=size=320x240:rate=10',
			'-f',
			'lavfi',
			'-i',
			'sine=frequency=1000',
			'-t',
			String(durationSeconds),
			'-c:v',
			'libx264',
			'-preset',
			'ultrafast',
			'-pix_fmt',
			'yuv420p',
			'-c:a',
			'aac',
			'-shortest',
			mediaPath,
		],
		{ stdio: 'pipe' },
	);
	return mediaPath;
}

async function launchGanzo(options = {}) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ganzo-e2e-'));
	const outputDirectory = path.join(directory, 'frames');
	await fs.mkdir(outputDirectory);
	const mediaPath =
		options.mediaPath ??
		(await createFixture(directory, options.duration ?? 4));
	const outputPath = path.join(directory, 'extracted.mp3');
	const application = await electron.launch({
		executablePath: require('electron'),
		args: [
			...(process.platform === 'linux'
				? [
						'--ozone-platform=x11',
						'--no-sandbox',
						'--disable-gpu',
						'--disable-dev-shm-usage',
					]
				: []),
			`--user-data-dir=${path.join(directory, 'user-data')}`,
			projectRoot,
		],
		env: {
			...process.env,
			NODE_ENV: 'production',
			ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
		},
		timeout: 45_000,
	});
	const page = await application.firstWindow();
	await expect(
		page.getByRole('heading', { name: 'Media', exact: true }),
	).toBeVisible({
		timeout: 20_000,
	});

	await application.evaluate(
		({ dialog, shell }, paths) => {
			globalThis.__ganzoE2E = { revealed: [] };
			dialog.showOpenDialog = async (windowOrOptions, maybeOptions) => {
				const dialogOptions = maybeOptions ?? windowOrOptions;
				const isDirectory =
					dialogOptions?.properties?.includes('openDirectory') ??
					false;
				return {
					canceled: false,
					filePaths: [
						isDirectory ? paths.outputDirectory : paths.mediaPath,
					],
				};
			};
			dialog.showSaveDialog = async () => ({
				canceled: false,
				filePath: paths.outputPath,
			});
			shell.showItemInFolder = (target) => {
				globalThis.__ganzoE2E.revealed.push(target);
			};
			shell.openPath = async (target) => {
				globalThis.__ganzoE2E.revealed.push(target);
				return '';
			};
		},
		{ mediaPath, outputPath, outputDirectory },
	);

	return {
		application,
		page,
		directory,
		mediaPath,
		outputPath,
		outputDirectory,
		async close() {
			await application.close().catch(() => {});
			await fs.rm(directory, { recursive: true, force: true });
		},
	};
}

async function selectMedia(page) {
	await page.getByRole('button', { name: 'Choose media' }).click();
	await expect(
		page.getByRole('heading', { name: 'Review media' }),
	).toBeVisible();
}

async function acceptMedia(page) {
	await page.getByRole('button', { name: 'Use this media' }).click();
	await expect(
		page.getByRole('heading', { name: 'Choose extraction' }),
	).toBeVisible();
}

async function chooseAction(page, action) {
	if (action === 'frames') {
		await page.getByRole('button', { name: 'Next action' }).click();
		await expect(
			page.getByRole('heading', { name: 'Extract frames to JPG' }),
		).toBeVisible();
	}
	await page.getByRole('button', { name: 'Select', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Configure and run' }),
	).toBeVisible();
}

async function revealedOutputs(application) {
	return application.evaluate(() => globalThis.__ganzoE2E.revealed);
}

module.exports = {
	acceptMedia,
	chooseAction,
	createFixture,
	ffmpegPath,
	launchGanzo,
	revealedOutputs,
	selectMedia,
};
