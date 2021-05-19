/*
 * Context bridge exposed API.
 */

import type { FileFilter } from "electron"
import type { MediaFileData } from "./utils/types";
import type { showToastFunc } from "./utils/toasts";

export type OnPageNavigationCallback = (from: number, to: number, direction: "up" | "down") => void; 
export type OnOpenFileCallback = (media: MediaFileData, filename: string) => void;
export type OnConversionProgressCallback = (percent: number) => void;
export type OnSaveFileSelectedCallback = (filename: string) => void;

/**
 * API exposed from preload script to the renderer `window["api"]` global variable.
 */
export type WebApi = {
	/**
	 * Adds a listener to invoke when page was fully loaded.
	 * @param listener The listener to register.
	 */
	addDomReadyListeners(listener: () => void): void;
	/**
	 * Page's template functions collection.
	 */
	template: {
		/**
		 * Registers the template function which shows a toast.
		 * @param showToastCb The reference to the function which shows a toast message.
		 */
		registerShowToast(showToastCb: showToastFunc): void;
		/**
		 * Registers the template function which updates the conversion progress bar.
		 * @param callback The reference to the function which updates the UI.
		 */
		registerConversionProgressCallback(callback: OnConversionProgressCallback): void;
		/**
		 * Registers the template function which responds on navigation.
		 * @param callback The reference to the function invoked on navigation.
		 */
		registerNavigationCallback(callback: OnPageNavigationCallback): void;
		/**
		 * Moves full-page layout to given section.
		 * @param identifier The section identifier to reach.
		 */
		goToSection(identifier: number): void;
	};
	/**
	 * Selects the input file and analyses it.
	 * @param filename The path of the selected file.
	 * @returns The promise which resolves to the file metadata when analysis is complete.
	 */
	selectFile(filename: string): Promise<MediaFileData>;
	/**
	 * Removes currently selected file.
	 */
	unselectFile(): void;
	/**
	 * Shows the file open dialog and invokes callback when file is selected and successfully analyzed.
	 * @param callback The callback to invoke when file metadata are ready.
	 */
	openFileSelector(callback: OnOpenFileCallback): void;
	/**
	 * Shows the file save dialog and invokes callback when file is selected.
	 * @param fileFilter The file filter to show.
	 * @param callback The callback to invoke when destination file is selected.
	 */
	saveFileSelector(fileFilter: FileFilter, callback: OnSaveFileSelectedCallback): void;
	/**
	 * Opens the file system explorer and shows given file.
	 * @param filename The file name to show in the file explorer.
	 */
	showFileInSystemExplorer(filename: string): void;
	/**
	 * Conversion functionalities.
	 */
	convert: {
		/**
		 * Extracts audio from selected video.
		 * @param targetPath The path to store MP3 to.
		 * @returns The asynchronous operation promise which resolves with the target path.
		 */
		extractAudioToMp3(targetPath: string): Promise<string>;
		/**
		 * Aborts the currently running conversion.
		 */
		abortCurrentConversion(): void;
	}
}
