import { readdirSync } from "fs";
import getFfmpegPath from "./ffmpeg/binary";
import configs from "./ffmpeg/configs";
import Ffmpeg from "./ffmpeg/ffmpeg";
import * as presets from "./ffmpeg/presets";
import { RunningFfmpeg } from "./ffmpeg/process";
import { MediaFile } from "./ffmpeg/video";
import * as path from "path";


/**
 * Path separator.
 */
const PS = path.sep;

/**
 * Main entry point for selection and interaction of media files.
 */
export class MediaManager {

	private static ffmpeg: Ffmpeg | null = null;
	private static media: MediaFile | null = null;
	private static runningConversion: RunningFfmpeg | null = null;

	/**
	 * Initializes the media manager and required resources.
	 */
	public static init(): void {
		Ffmpeg.bin = getFfmpegPath();
		Ffmpeg.getSupportedInfo(configs, info =>
			console.log("ffmpeg supported info:\n - Encodes: " + info.encode +
				"\n - Decodes: " + info.decode +
				"\n - Modules: " + info.modules));
	}

	/**
	 * Selects given input file.
	 * @param filename The name of file to select.
	 * @returns The promise of the operation which resolves to the media file.
	 */
	public static selectInputFile(filename: string): Promise<MediaFile> {
		return new Promise<MediaFile>((resolve, reject) => {
			// Runs file analysis asynchronously.
			MediaManager.ffmpeg = new Ffmpeg(filename, (err, video) => {
				if (video) {
					// Stores video metadata and report to async op.
					MediaManager.media = new MediaFile(filename, Ffmpeg.supportedInfo!, video);
					resolve(MediaManager.media);

				} else {
					// Rejects async op with error.
					reject(err);
				}
			});
		})
	}

	/**
	 * De-selects current input media.
	 */
	public static unselectInputFile(): void {
		MediaManager.media = null;
	}

	/**
	 * Aborts the currently running conversion.
	 */
	public static abortCurrentConversion() {
		if (MediaManager.runningConversion) {
			MediaManager.runningConversion.abort();
		}
	}

	/**
	 * Extracts the audio of the selected file to Mp3.
	 * @param destFileName The target filename.
	 * @param onProgressCallback The callback invoked when progress percent changed.
	 * @returns The promise which resolves to the stored file name.
	 */
	public static extractsAudioToMp3(destFileName: string, onProgressCallback: (percent: number) => void): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (!MediaManager.media) {
				reject(new Error("No input file selected!"));

			} else {
				// Run async conversion.
				let ffmpegInst = presets.extractSoundToMp3(MediaManager.media, destFileName, (err, result) => {
					if (result) {
						resolve(result);
					} else {
						reject(err);
					}
				});

				ffmpegInst.registerOnProgressCallback(MediaManager.media, onProgressCallback);
				MediaManager.runningConversion = ffmpegInst;
			}
		});
	}

	/**
	 * 
	 * @param destinationFolder The folder used to store extracted images.
	 * @param customSettings The settings for the extraction.
	 * @param onProgressCallback The on-progress callback.
	 * @returns The promise of the operation which resolves to the list of extracted files.
	 */
	public static extractFramesToJPG(destinationFolder: string,
		customSettings: presets.ExtractFrameToJPGSettings, onProgressCallback: (percent: number) => void): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			if (!MediaManager.media) {
				reject(new Error("No input file selected!"));

			} else {
				// Run async conversion.
				let ffmpegInst = presets.extractFrameToJPG(MediaManager.media, destinationFolder, customSettings, (err, result) => {
					if (result) {
						let folder = result;
						// Clean possible "/" at the end of the string
						if (folder.charAt(folder.length - 1) == PS) {
							folder = folder.substr(0, folder.length - 1);
						}
						// Read file list inside the folder
						let resultFiles: string[] = readdirSync(folder);
						// Scan all file and prepend the folder path
						for (var i in resultFiles) {
							resultFiles[i] = [folder, resultFiles[i]].join(PS);
						}

						if (!resultFiles || resultFiles.length == 0) {
							// If result folder contains no file.
							reject(new Error("No output file was produced!"));
						}

						resolve(resultFiles);
					} else {
						reject(err);
					}
				});

				ffmpegInst.registerOnProgressCallback(MediaManager.media, onProgressCallback);
				MediaManager.runningConversion = ffmpegInst;
			}
		});
	}

}
