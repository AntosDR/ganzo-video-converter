import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import Main from './electron-main';
import { videoExt, audioExt } from "../file-formats";
import getFfmpegPath from '../ffmpeg/binary';

Main.main(app, BrowserWindow, appReady);

function appReady(window: BrowserWindow) {
	console.log("Ganzo Video Converter started: "+app.getVersion());
	console.log("ffmpeg path: "+getFfmpegPath());
}

ipcMain.on("request-file-open", (event) => {
	dialog.showOpenDialog(Main.mainWindow!, {
		title: "Select a media file",
		message: "Choose input file to edit:",
		properties: ['openFile'],
		filters: [{
			extensions: [...videoExt],
			name: "Video file"
		}, {
			extensions: [...audioExt],
			name: "Audio file"
		}]
	}).then(o => {
		if (!o.canceled && o.filePaths.length >= 1) {
			event.sender.send("request-file-open-selected", o.filePaths[0]);
		}
	});
});

ipcMain.on("request-file-save", (event, filter: Electron.FileFilter) => {
	dialog.showSaveDialog(Main.mainWindow!, {
		title: "Select destination file",
		properties: ['showOverwriteConfirmation'],
		filters: [filter]
	}).then(o => {
		if (!o.canceled && o.filePath) {
			event.sender.send("request-file-save-selected", o.filePath);
		}
	});
});

