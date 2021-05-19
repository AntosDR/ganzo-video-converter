/*
 * Binary path retriever.
 */

import ffmpegBin = require("ffmpeg-static-electron");

/**
 * Standard path for the library.
 */
const ORIGINAL_PATH = 'app.asar';
/**
 * Real path after packaging.
 */
const UNPACKED_PATH = 'app.asar.unpacked';

/**
 * Retrieves the path to the ffmpeg binary executable.
 * @returns The ffmpeg binary path.
 */
export default function getFfmpegPath() {
	let path: string = ffmpegBin.path;
	let occ = path.lastIndexOf(ORIGINAL_PATH);
	if (occ != -1 && occ != path.lastIndexOf(UNPACKED_PATH)) {
		// Replace last occurrence.
		return path.substring(0, occ) + UNPACKED_PATH + path.substring(occ + ORIGINAL_PATH.length);
	}
	return path;
}
