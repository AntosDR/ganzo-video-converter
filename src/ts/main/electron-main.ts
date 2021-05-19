import { BrowserWindow } from 'electron';
import { join } from "path"; 

export interface AppWindowReadyCallback {
	(window: BrowserWindow): void;
}

export default class Main {

	static mainWindow: Electron.BrowserWindow|null;
	static application: Electron.App;
	static BrowserWindow: typeof BrowserWindow;
	static readyCallback:AppWindowReadyCallback;

	private static onWindowAllClosed() {
		if (process.platform !== 'darwin') {
			Main.application.quit();
		}
	}

	private static onClose() {
		// Dereference the window object. 
		Main.mainWindow = null;
	}

	private static createWindow() {
		Main.mainWindow = new Main.BrowserWindow({
			width: 800,
			height: 600,
			webPreferences: {
				nodeIntegration: false,
				preload: join(__dirname, "../preload.js")
			}
		});
		Main.mainWindow
			.loadURL('file://' + __dirname + '/../../pages/index.html');
		Main.mainWindow.on('closed', Main.onClose);
		Main.mainWindow.on("ready-to-show", () => Main.readyCallback(Main.mainWindow!));
	}

	private static onReady() {
		Main.createWindow();

		Main.application.on("activate", function () {
			// On macOS it's common to re-create a window in the app when the
			// dock icon is clicked and there are no other windows open.
			if (Main.BrowserWindow.getAllWindows().length === 0) {
				Main.createWindow();
			}
		});
	}

	static main(app: Electron.App, browserWindow: typeof BrowserWindow, callback:AppWindowReadyCallback) {
		// we pass the Electron.App object and the  
		// Electron.BrowserWindow into this function 
		// so this class has no dependencies. This 
		// makes the code easier to write tests for 
		Main.BrowserWindow = browserWindow;
		Main.application = app;
		Main.readyCallback = callback;
		Main.application.on('window-all-closed', Main.onWindowAllClosed);
		Main.application.on('ready', Main.onReady);
	}

}
