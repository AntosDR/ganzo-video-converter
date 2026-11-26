/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build`, this file is compiled to
 * `./release/app/dist/main/main.js` using electron-vite.
 */
import path from 'path';
import {
	app,
	BrowserWindow,
	shell,
	ipcMain,
	IpcMainInvokeEvent,
} from 'electron';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import startAutoUpdates from './updates';
import { MediaService } from './media-service';
import { resolveFfmpegPath } from './ffmpeg-path';
import type { StartExtractionRequest } from '../shared/media-contract';

console.log('Running in', process.env.NODE_ENV, 'mode');

let mainWindow: BrowserWindow | null = null;
const ffmpegPath = resolveFfmpegPath({
	isPackaged: app.isPackaged,
	resourcesPath: process.resourcesPath,
	appPath: app.getAppPath(),
});
const mediaService = new MediaService(ffmpegPath);

/** Accepts IPC only from the top-level frame of the current application window. */
const trusted = (event: IpcMainInvokeEvent) =>
	mainWindow !== null &&
	event.sender === mainWindow.webContents &&
	event.senderFrame?.top === event.senderFrame &&
	event.senderFrame?.url === mainWindow.webContents.getURL();

const VALID_KINDS = new Set([
	'audio-extract',
	'audio-replace',
	'audio-mute',
	'cover-jpg',
	'frames-jpg',
]);
const VALID_AUDIO_FORMATS = new Set(['mp3', 'aac', 'wav', 'flac', 'ogg']);

ipcMain.handle('media:select', async (event) => {
	if (!trusted(event) || !mainWindow) throw new Error('Untrusted renderer.');
	return mediaService.selectMedia(mainWindow);
});

ipcMain.handle('media:select-audio', async (event) => {
	if (!trusted(event) || !mainWindow) throw new Error('Untrusted renderer.');
	return mediaService.selectAudioFile(mainWindow);
});

ipcMain.handle('media:inspect-drop', async (event, filePath: unknown) => {
	if (!trusted(event) || typeof filePath !== 'string')
		throw new Error('Untrusted or invalid request.');
	return mediaService.inspect(filePath);
});

ipcMain.handle('media:clear', async (event) => {
	if (!trusted(event)) throw new Error('Untrusted renderer.');
	mediaService.clearSelection();
});

ipcMain.handle('media:choose-output', async (event, request: unknown) => {
	if (!trusted(event) || !mainWindow) throw new Error('Untrusted renderer.');
	if (
		!request ||
		typeof request !== 'object' ||
		!('jobId' in request) ||
		!('kind' in request) ||
		typeof request.jobId !== 'string' ||
		typeof request.kind !== 'string' ||
		!VALID_KINDS.has(request.kind)
	)
		throw new Error('Invalid output selection request.');
	const format =
		'format' in request &&
		typeof request.format === 'string' &&
		VALID_AUDIO_FORMATS.has(request.format)
			? (request.format as 'mp3' | 'aac' | 'wav' | 'flac' | 'ogg')
			: undefined;
	return mediaService.chooseOutput(
		mainWindow,
		request.jobId,
		request.kind as StartExtractionRequest['kind'],
		format,
	);
});

ipcMain.handle(
	'media:start',
	async (event, request: StartExtractionRequest) => {
		if (!trusted(event) || !mainWindow)
			throw new Error('Untrusted renderer.');
		if (!request || !VALID_KINDS.has(request.kind)) {
			return {
				status: 'error',
				message: 'Unsupported extraction action.',
			};
		}
		return mediaService.start(
			mainWindow,
			event.sender,
			request,
			(percent) => {
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.webContents.send('media:progress', {
						jobId: request.jobId,
						percent,
						status: 'running',
					});
				}
			},
		);
	},
);

ipcMain.handle('media:abort', async (event, jobId: unknown) => {
	if (!trusted(event) || typeof jobId !== 'string')
		throw new Error('Untrusted or invalid request.');
	mediaService.abort(event.sender, jobId);
});

ipcMain.handle('media:reveal', async (event, jobId: unknown) => {
	if (!trusted(event) || typeof jobId !== 'string')
		throw new Error('Untrusted or invalid request.');
	mediaService.reveal(event.sender, jobId);
});

if (process.env.NODE_ENV === 'production') {
	process.setSourceMapsEnabled(true);
}

const isDebug =
	process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
	app.commandLine.appendSwitch('enable-logging');
}

if (isDebug) {
	void import('electron-debug')
		.then(({ default: debug }) => debug())
		.catch(console.error);
}

app.on('child-process-gone', (_event, details) => {
	log.error('An Electron child process exited unexpectedly', details);
});

/** Installs React Developer Tools when the app is running in debug mode. */
const installExtensions = async () => {
	const { installExtension, REACT_DEVELOPER_TOOLS } =
		await import('electron-devtools-installer');
	return installExtension(REACT_DEVELOPER_TOOLS, {
		forceDownload: !!process.env.UPGRADE_EXTENSIONS,
	}).catch(console.log);
};

/** Creates the secured renderer window and installs its application menu. */
const createWindow = async () => {
	if (isDebug) {
		await installExtensions();
	}

	const RESOURCES_PATH = app.isPackaged
		? path.join(process.resourcesPath, 'assets')
		: path.join(app.getAppPath(), 'assets');

	/** Resolves an application asset from the packaged or development assets folder. */
	const getAssetPath = (...paths: string[]): string => {
		return path.join(RESOURCES_PATH, ...paths);
	};

	console.log('Creating main window...');

	try {
		const preloadPath = path.join(__dirname, '../preload/preload.js');
		const assetPath = getAssetPath('icon.png');
		mainWindow = new BrowserWindow({
			show: false,
			width: 1024,
			height: 728,
			icon: assetPath,
			webPreferences: {
				preload: preloadPath,
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
			},
		});
		console.log('Main window created');
	} catch (error) {
		console.error('Failed to create the main window', error);
		throw error;
	}

	mainWindow.on('ready-to-show', () => {
		if (!mainWindow) {
			console.error('mainWindow is not defined');
			throw new Error('"mainWindow" is not defined');
		}
		if (process.env.START_MINIMIZED) {
			mainWindow.minimize();
		} else {
			mainWindow.show();
		}
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	const menuBuilder = new MenuBuilder(mainWindow);
	menuBuilder.buildMenu();

	// Open urls in the user's browser
	mainWindow.webContents.setWindowOpenHandler((edata) => {
		if (/^https:\/\//.test(edata.url)) {
			void shell.openExternal(edata.url);
		}
		return { action: 'deny' };
	});
	mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
		const currentUrl = mainWindow?.webContents.getURL();
		if (!currentUrl || navigationUrl !== currentUrl) event.preventDefault();
	});

	await mainWindow.loadURL(resolveHtmlPath('index.html'));
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
	// Respect the OSX convention of having the application in memory even
	// after all windows have been closed
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

/** Logs a window startup failure and disposes of the failed window. */
function reportWindowError(error: unknown) {
	log.error('Failed to create the application window', error);
	mainWindow?.destroy();
	mainWindow = null;
}

/** Recreates the main window when macOS reactivates the application. */
function onActivate() {
	// Reopening a macOS window must not initialize another updater.
	if (mainWindow === null) {
		void createWindow().catch(reportWindowError);
	}
}

app.whenReady()
	.then(async () => {
		await createWindow();
		startAutoUpdates();
		app.on('activate', onActivate);
	})
	.catch((error: unknown) => {
		reportWindowError(error);
		app.quit();
	});
