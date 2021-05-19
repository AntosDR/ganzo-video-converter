import * as fs from "fs";
import * as path from "path";
import { throwError } from "./errors";
import Ffmpeg from "./ffmpeg";
import { Duration, mergeObject, mkdir } from "./utils";
import { MediaFile, WatermarkSettings } from "./video";
import { FfmpegRunBuilder, FfmpegRunCompleteCallback, RunningFfmpeg } from "./process";

/**
 * Path separator.
 */
const PS = path.sep;

export const size = {
	'SQCIF': '128x96',
	'QCIF': '176x144',
	'CIF': '352x288',
	'4CIF': '704x576',
	'QQVGA': '160x120',
	'QVGA': '320x240',
	'VGA': '640x480',
	'SVGA': '800x600',
	'XGA': '1024x768',
	'UXGA': '1600x1200',
	'QXGA': '2048x1536',
	'SXGA': '1280x1024',
	'QSXGA': '2560x2048',
	'HSXGA': '5120x4096',
	'WVGA': '852x480',
	'WXGA': '1366x768',
	'WSXGA': '1600x1024',
	'WUXGA': '1920x1200',
	'WOXGA': '2560x1600',
	'WQSXGA': '3200x2048',
	'WQUXGA': '3840x2400',
	'WHSXGA': '6400x4096',
	'WHUXGA': '7680x4800',
	'CGA': '320x200',
	'EGA': '640x350',
	'HD480': '852x480',
	'HD720': '1280x720',
	'HD1080': '1920x1080'
} as const;

export const ratio = {
	'4:3': 1.33,
	'3:2': 1.5,
	'14:9': 1.56,
	'16:9': 1.78,
	'21:9': 2.33
} as const;

export const audio_channel = {
	'mono': 1,
	'stereo': 2
} as const;

/**
 * Extracts sound from a video and save it as Mp3.
 * @param media The source media file.
 * @param destinationFileName The destination Mp3 filename.
 * @param callback The callback to invoke on completion.
 * @returns The running instance.
 */
export function extractSoundToMp3(media: MediaFile, destinationFileName: string, callback: FfmpegRunCompleteCallback): RunningFfmpeg {
	// Check if file already exists. In this case will remove it
	if (fs.existsSync(destinationFileName)) {
		fs.unlinkSync(destinationFileName);
	}

	const mediaClone: MediaFile = new MediaFile(media.file_path, media.info_configuration, media.metadata);

	// Building the final path
	let destinationDirName = path.dirname(destinationFileName);
	let destinationFileNameWE = path.basename(destinationFileName, path.extname(destinationFileName)) + '.mp3';
	let finalPath = path.join(destinationDirName, destinationFileNameWE);

	mediaClone.setDisableVideo();
	mediaClone.setAudioFrequency(44100);
	mediaClone.setAudioChannels(2);
	mediaClone.setAudioBitRate(192);
	mediaClone.setAudioCodec("mp3");

	return mediaClone.save(finalPath, callback);
}

export type ExtractFrameToJPGSettings = {
	/**
	 * Start time to recording
	 */
	start_time?: Duration | null;
	/**
	 * Duration of recording
	 */
	duration_time?: Duration | null;
	/**
	 * Number of the frames to capture in one second.
	*/
	frame_rate?: number | null;
	/**
	 * Dimension each frame
	 */
	size?: string | null;
	/**
	 * Total frame to capture
	 */
	number?: number | null;
	/**
	 * Frame to capture every N frames
	 */
	every_n_frames?: number | null;
	/**
	 * Frame to capture every N seconds
	 */
	every_n_seconds?: number | null;
	/**
	 * Frame to capture every N percentage range
	 */
	every_n_percentage?: number | null;
	/**
	 * Maintain the original pixel video aspect ratio
	 */
	keep_pixel_aspect_ratio: boolean;
	/**
	 * Maintain the original aspect ratio
	 */
	keep_aspect_ratio: boolean;
	/**
	 * Padding color
	 */
	padding_color?: string;
	/**
	 * File name
	 */
	file_name?: string | null
}

/**
 * Extract frame from video file.
 * @param media The source media.
 * @param destinationFolder The destination folder for extracted frames.
 * @param customSettings The custom run setting.
 * @param callback A callback to invoke on completion.
 * @returns The running instance.
 */
export function extractFrameToJPG(media: MediaFile, destinationFolder: string,
	customSettings: ExtractFrameToJPGSettings, callback: FfmpegRunCompleteCallback): RunningFfmpeg {
	// Default settings overridden with input argument.
	let settings: ExtractFrameToJPGSettings = mergeObject<ExtractFrameToJPGSettings>({
		start_time: null,
		duration_time: null,
		frame_rate: null,
		size: null,
		number: null,
		every_n_frames: null,
		every_n_seconds: null,
		every_n_percentage: null,
		keep_pixel_aspect_ratio: true,
		keep_aspect_ratio: true,
		padding_color: 'black',
		file_name: null
	}, customSettings);

	const mediaClone: MediaFile = new MediaFile(media.file_path, media.info_configuration, media.metadata);

	// Check if the value of the framerate is number type
	if (settings.frame_rate != null && isNaN(settings.frame_rate))
		settings.frame_rate = null;

	// If the size is not settings then the size of the screenshots is equal to video size
	if (settings.size == null)
		settings.size = media.metadata.video.resolution.w + 'x' + media.metadata.video.resolution.h;

	// Check if the value of the 'number frame to capture' is number type
	if (settings.number != null && isNaN(settings.number))
		settings.number = null;

	let every_n_check = 0;

	// Check if the value of the 'every_n_frames' is number type
	if (settings.every_n_frames != null && isNaN(settings.every_n_frames)) {
		settings.every_n_frames = null;
		every_n_check++;
	}

	// Check if the value of the 'every_n_seconds' is number type
	if (settings.every_n_seconds != null && isNaN(settings.every_n_seconds)) {
		settings.every_n_seconds = null;
		every_n_check++;
	}

	// Check if the value of the 'every_n_percentage' is number type
	if (settings.every_n_percentage != null && (isNaN(settings.every_n_percentage) || settings.every_n_percentage > 100)) {
		settings.every_n_percentage = null;
		every_n_check++;
	}

	if (every_n_check >= 2) {
		throwError('extract_frame_invalid_everyN_options');
	}

	// If filename is null then his value is equal to original filename
	if (settings.file_name == null) {
		settings.file_name = path.basename(this.file_path, path.extname(this.file_path));
	} else {
		// Retrieve all possible replacements
		let replacements = settings.file_name.match(/(\%[a-zA-Z]{1})/g);
		// Check if exists replacements. The scan all replacements and build the final filename
		if (replacements) {
			for (var i in replacements) {
				switch (replacements[i]) {
					case '%t':
						settings.file_name = settings.file_name.replace('%t', new Date().getTime().toString());
						break;
					case '%s':
						settings.file_name = settings.file_name.replace('%s', settings.size);
						break;
					case '%x':
						settings.file_name = settings.file_name.replace('%x', settings.size.split(':')[0]);
						break;
					case '%y':
						settings.file_name = settings.file_name.replace('%y', settings.size.split(':')[1]);
						break;
					default:
						settings.file_name = settings.file_name.replace(replacements[i], '');
						break;
				}
			}
		}
	}
	// At the filename will added the number of the frame
	settings.file_name = path.basename(settings.file_name, path.extname(settings.file_name)) + '_%d.jpg';

	// Create the directory to save the extracted frames
	mkdir(destinationFolder, 0x0777);

	const run: FfmpegRunBuilder = new FfmpegRunBuilder(Ffmpeg.bin);

	// Adding commands to the list
	if (settings.start_time) {
		run.addCommand('-ss', settings.start_time.durationSeconds);
	}
	if (settings.duration_time) {
		run.addCommand('-t', settings.duration_time.durationSeconds);
	}
	if (settings.frame_rate) {
		run.addCommand('-r', settings.frame_rate);
	}

	// Setting the size and padding settings
	mediaClone.setVideoSize(settings.size, settings.keep_pixel_aspect_ratio, settings.keep_aspect_ratio, settings.padding_color);
	// Get the dimensions
	let newDimension = mediaClone.calculateNewDimension();
	// Apply the size and padding commands
	run.addCommand('-s', newDimension.width + 'x' + newDimension.height);
	// CHeck if isset aspect ratio options
	if (newDimension.aspect != null) {
		run.addFilterComplex('scale=iw*sar:ih, pad=max(iw\\,ih*(' + newDimension.aspect.x + '/'
			+ newDimension.aspect.y + ')):ow/(' + newDimension.aspect.x + '/' + newDimension.aspect.y
			+ '):(ow-iw)/2:(oh-ih)/2' + (settings.padding_color != null ? ':' + settings.padding_color : ''));
		run.addCommand('-aspect', newDimension.aspect.string);
	}

	if (settings.number) {
		run.addCommand('-vframes', settings.number);
	}
	if (settings.every_n_frames) {
		run.addCommand('-vsync', 0);
		run.addFilterComplex('select=not(mod(n\\,' + settings.every_n_frames + '))');
	}
	if (settings.every_n_seconds) {
		run.addCommand('-vsync', 0);
		run.addFilterComplex('select=not(mod(t\\,' + settings.every_n_seconds + '))');
	}
	if (settings.every_n_percentage) {
		run.addCommand('-vsync', 0);
		run.addFilterComplex('select=not(mod(t\\,' + ((mediaClone.metadata.duration.seconds / 100) * settings.every_n_percentage) + '))');
	}

	// Add destination file path to the command list
	run.setOutput([destinationFolder, settings.file_name].join(PS));

	// Executing the command
	return run.execute(callback, destinationFolder);
}

/**
 * Add a watermark to the video and save it.
 * @param media The source media.
 * @param watermarkPath The path to the watermark image file.
 * @param callback The callback to invoke on completion.
 * @param newFilepath The new file-path of the produced file.
 * @param settings Watermark placement settings.
 * @returns The running instance.
 */
export function addWatermark(media: MediaFile, watermarkPath: string, callback: FfmpegRunCompleteCallback, newFilepath?: string,
	settings?: WatermarkSettings,): RunningFfmpeg {

	const mediaClone: MediaFile = new MediaFile(media.file_path, media.info_configuration, media.metadata);

	// Call the function to add the watermark options
	mediaClone.setWatermark(watermarkPath, settings);

	if (!newFilepath) {
		newFilepath = path.dirname(mediaClone.file_path) + '/' +
			path.basename(mediaClone.file_path, path.extname(mediaClone.file_path)) + '_watermark_' +
			path.basename(watermarkPath, path.extname(watermarkPath)) +
			path.extname(mediaClone.file_path);
	}

	// Add destination file path to the command list
	return mediaClone.save(newFilepath, callback, cb => cb.addCommand('-strict', -2));
}
