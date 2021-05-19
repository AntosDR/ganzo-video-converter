// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

import type { FileFilter } from 'electron';
import { contextBridge, ipcRenderer, shell } from 'electron';
import { basename, extname } from "path";
import { MediaFile } from './ffmpeg/video';
import { isValidExtension } from "./file-formats";
import { MediaManager } from './media-manager';
import type { WebApi, OnConversionProgressCallback, OnOpenFileCallback, OnSaveFileSelectedCallback, OnPageNavigationCallback } from "./renderer/context-bridge-api";
import type { showToastFunc } from "./renderer/utils/toasts";
const fullpage = require("fullpage.js");


var fullPageInstance: any = null;
var pageReady: boolean = false;
var domReadyListeners: (() => void)[] = [];
var showToast: showToastFunc;
var fileSelectorOnSelectedCallback: OnOpenFileCallback | null = null;
var fileOutputSelectorOnSelectedCallback: OnSaveFileSelectedCallback | null = null;
var conversionProgressCallback: OnConversionProgressCallback;
var navigationCallback: OnPageNavigationCallback;

/**
 * Checks whether the file extension is valid or not.
 * @param filePath The file path to check.
 * @returns Whether the file is valid or not.
 */
function checkCorrectFileExtension(filePath: string): boolean {
	const ext = extname(filePath).substring(1);
	if (isValidExtension(ext)) {
		return true;
	} else {
		showToast("error", "Invalid file!", `File extension not recognized! (${ext})`);
		return false;
	}
}

// Invoked when DOM is ready.
window.addEventListener("DOMContentLoaded", () => {
	// Inits ffmpeg and related tools.
	MediaManager.init();

	pageReady = true;

	fullPageInstance = new fullpage('#fullpage', {
		navigation: false,
		controlArrows: true,
		slidesNavigation: true,
		keyboardScrolling: false,
		sectionsColor: ['#ff5f45', '#0798ec', '#fc6c7c'],
		onLeave: function(origin: any, destination:any, direction:"up"|"down"){
			navigationCallback(origin.index, destination.index, direction);
		}
	});
	fullPageInstance.setAllowScrolling(true, "left, right");
	fullPageInstance.setAllowScrolling(false, "up, down");
	fullPageInstance.setKeyboardScrolling(true, "left, right");
	fullPageInstance.setKeyboardScrolling(false, "up, down");

	domReadyListeners.forEach(f => f());
});

// Invoked from main, when a file open dialog selects a file.
ipcRenderer.on("request-file-open-selected", (_event, filePath: string) => {
	if (fileSelectorOnSelectedCallback) {
		let cb = fileSelectorOnSelectedCallback;
		if (!checkCorrectFileExtension(filePath)) {
			// If invalid file, aborts!
			return;
		}
		MediaManager.selectInputFile(filePath)
			.then(media => cb(media, basename(filePath)));
	}
});

// Invoked from main, when a file save dialog selects a file.
ipcRenderer.on("request-file-save-selected", (_event, filePath: string) => {
	if (fileOutputSelectorOnSelectedCallback) {
		fileOutputSelectorOnSelectedCallback(filePath);
	}
});

// Context bridge registered on window["api"] global variable.
const WEB_API: WebApi = {
	addDomReadyListeners: (listener: () => void) => {
		if (pageReady) {
			listener();
		} else {
			domReadyListeners.push(listener);
		}
	},
	template: {
		registerShowToast: (showToastCb: showToastFunc) => { showToast = showToastCb; },
		registerConversionProgressCallback: (callback: OnConversionProgressCallback) => { conversionProgressCallback = callback; },
		registerNavigationCallback: (callback: OnPageNavigationCallback) => { navigationCallback = callback; },
		goToSection: (identifier: number) => fullPageInstance.moveTo(identifier)
	},
	selectFile: (filename: string) => {
		if (!checkCorrectFileExtension(filename)) {
			return Promise.reject(new Error("Invalid file format!"));
		}
		return MediaManager.selectInputFile(filename);
	},
	unselectFile: () => {
		MediaManager.unselectInputFile();
	},
	openFileSelector: (callback: OnOpenFileCallback) => {
		fileSelectorOnSelectedCallback = callback;
		ipcRenderer.send("request-file-open");
	},
	saveFileSelector: (fileFilter: FileFilter, callback: (filename: string) => void) => {
		fileOutputSelectorOnSelectedCallback = callback;
		ipcRenderer.send("request-file-save", fileFilter);
	},
	showFileInSystemExplorer: (filename: string) => {
		shell.showItemInFolder(filename);
	},
	convert: {
		extractAudioToMp3: (filename: string) =>
			MediaManager.extractsAudioToMp3(filename, conversionProgressCallback),
		abortCurrentConversion: () => MediaManager.abortCurrentConversion()
	}
};

// Registers and exports context bridge.
contextBridge.exposeInMainWorld("api", WEB_API);
