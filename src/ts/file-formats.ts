/*
 * Formats for supported audio and video files.
 */

export const videoExt: readonly string[] = [
	"webm", "mkv", "flv", "flv", "vob", "ogv", "ogg", "drc",
	"gif", "gifv", "mng", "avi", "MTS", "M2TS", "TS", "mov",
	"qt", "wmv", "yuv", "rm", "rmvb", "viv", "asf", "amv",
	"mp4", "m4p", "m4v", "mpg", "mp2", "mpeg", "mpe", "mpv",
	"mpg", "mpeg", "m2v", "m4v", "svi", "3gp", "3g2", "mxf",
	"roq", "nsv", "flv", "f4v", "f4p", "f4a", "f4b"
] as const;

export const audioExt: readonly string[] = [
	"3gp", "aa", "aac", "aax", "act", "aiff", "alac", "amr",
	"ape", "au", "awb", "dss", "dvf", "flac", "gsm", "iklax",
	"ivs", "m4a", "m4b", "m4p", "mmf", "mp3", "mpc", "msv",
	"nmf", "ogg", "oga", "mogg", "opus", "org", "ra", "rm",
	"raw", "rf64", "sln", "tta", "voc", "vox", "wav", "wma",
	"wv", "webm", "8svx", "cda"
] as const;

export const mediaExt = videoExt.concat(audioExt);

/**
 * Checks whether given extension is valid or not.
 * @param ext The extension to check.
 * @returns `true` if extension is valid, `false` otherwise.
 */
export function isValidExtension(ext: string) {
	if (ext.charAt(0) === ".") {
		ext = ext.substring(1);
	}
	return mediaExt.indexOf(ext) !== -1;
}
