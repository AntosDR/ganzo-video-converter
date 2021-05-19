/*
 * File-drop target area.
 */

import type { MediaFileData } from "./types";
import type { WebApi } from "../context-bridge-api";

export type FileSelectedCallback = (media: MediaFileData, filename: string) => void;
declare const api: WebApi;

/**
 * Drop target module.
 */
class FileDragTarget {

	private readonly holder: HTMLElement;
	private dragCount: number = 0;

	constructor(itemId: string, releaseOverlay: string, onFileSelected: FileSelectedCallback, resetFileInput: () => void) {
		this.holder = document.getElementById(itemId) as HTMLElement;
		this.holder.ondragenter = () => {
			if (this.dragCount == 0) {
				$(releaseOverlay).addClass("active");
			}
			this.dragCount++;
			return false;
		}
		this.holder.ondragover = (ev) => {
			ev.preventDefault();
			return false;
		}
		this.holder.ondragleave = () => {
			this.dragCount--;
			if (this.dragCount == 0) {
				$(releaseOverlay).removeClass("active");
			}
			return false;
		};
		this.holder.ondragend = () => {
			return false;
		}
		this.holder.ondrop = (e) => {
			e.preventDefault();
			this.dragCount = 0;
			$(releaseOverlay).removeClass("active");
			if ($('#active-media-file').hasClass("active")) {
				$('#active-media-file').removeClass("active");
			}

			if (e.dataTransfer && e.dataTransfer.files.length >= 1) {
				let file = e.dataTransfer.files[0] as (File & { path: string, name: string });
				console.log('File(s) you dragged here: ', file);
				api.selectFile(file.path).then((media) => onFileSelected(media, file.name));
			}

			return false;
		};
	}

}

var globalDropTarget: FileDragTarget | null = null;

/**
 * Initializes the drop target.
 * @param itemId The item selector.
 * @param releaseOverlay The release overlay selector.
 * @param onFileSelected The callback invoked on selection complete.
 * @param resetFileInput Resets currently selected file.
 */
export default function initializeFileDropTarget(itemId: string, releaseOverlay: string,
	onFileSelected: FileSelectedCallback, resetFileInput: () => void) {
	if (globalDropTarget == null) {
		globalDropTarget = new FileDragTarget(itemId, releaseOverlay, onFileSelected, resetFileInput);
	}
}

export type initializeFileDropTargetFunc = typeof initializeFileDropTarget;

