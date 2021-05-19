import { addQuotes, durationToSeconds,  gcd, mergeObject } from "./utils";
import configs, { FfmpegConfigs } from "./configs";
import { throwError } from "./errors";
import { existsSync } from "fs";
import {ffmpegRun} from "./process";


/**
 * Media file decoded information.
 */
export interface MediaFileInfo {
	filename?: string;
	title?: string;
	artist?: string;
	album?: string;
	track?: string;
	date?: string;
	synched: boolean;
	duration: {
		raw: string;
		seconds: number;
	};
	video: {
		container?: string;
		bitrate: number;
		stream: number;
		codec?: string;
		resolution: {
			w: number;
			h: number;
		};
		resolutionSquare?: {
			w: number;
			h: number;
		};
		aspect?: {
			x: number;
			y: number;
			label: string;
			value: number;
		};
		pixelString?: string;
		pixel?: number;
		rotate: number;
		fps: number;
	};
	audio: {
		codec?: string;
		bitrate?: number;
		sample_rate: number;
		stream: number;
		channels: {
			raw?: string;
			value?: string | number;
		};
	}
};

/**
 * Info of the supported modules, encoder and decoders.
 */
 export class FfmpegSupportedInfo {
	/**
	 * Constructs with initializers.
	 * @param modules Supported modules.
	 * @param encode Supported encode formats and codecs.
	 * @param decode Supported decode formats and codecs.
	 */
	constructor(
		public readonly modules: string[],
		public readonly encode: string[],
		public readonly decode: string[]) {
		// Builds initialized.
	}

	/**
	 * Checks if given format is supported and throws an error if not.
	 * @param format The format to check.
	 */
	public checkSupportedFormat(format: string): void | never {
		if (this.encode.indexOf(format) === -1) {
			throwError("format_not_supported", format);
		}
	}

	/**
	 * Checks if given coded is supported and throws an error if not.
	 * @param codec The codec to check.
	 */
	public checkSupportedCodec(codec: string): void | never {
		if (this.encode.indexOf(codec) === -1) {
			throwError("codec_not_supported", codec);
		}
	}

}

export type RetrieveInfoProcessCompleteCallback = (err: Error | null, video: MediaFileInfo | null) => void;

/**
 * Main class which retrieves info of an input media file and allows the processing on it.
 */
export default class Ffmpeg {
	public static bin: string = "ffmpeg";
	public static supportedInfo: FfmpegSupportedInfo | null = null;

	private readonly inputFile: string;
	private readonly settings: FfmpegConfigs;
	private callback: RetrieveInfoProcessCompleteCallback | null;

	private video: MediaFileInfo | null = null;
	private initError: Error | null = null;
	private initialized: boolean = false;

	/**
	 * Constructs with input file only.
	 * @param input Input file.
	 */
	constructor(input: string);
	/**
	 * Constructs with given input file and configurations.
	 * @param input  Input file.
	 * @param cfg The execution configurations.
	 */
	constructor(input: string, cfg: FfmpegConfigs);
	/**
	 * Constructs with given input file and callback.
	 * @param input Input file.
	 * @param callback The callback to invoke on completion.
	 */
	constructor(input: string, callback: RetrieveInfoProcessCompleteCallback);
	/**
	 * Constructs with given input file, configurations and callback.
	 * @param input Input file.
	 * @param cfg The execution configurations.
	 * @param callback The callback to invoke on completion.
	 */
	constructor(input: string, cfg: FfmpegConfigs, callback: RetrieveInfoProcessCompleteCallback);

	/**
	 * Constructor implementation for previous prototypes.
	 * @param input Input file.
	 * @param cfgOrCallback Configuration or callback first argument.
	 * @param inCallback The callback argument.
	 */
	constructor(input: string, cfgOrCallback?: FfmpegConfigs | RetrieveInfoProcessCompleteCallback, inCallback?: RetrieveInfoProcessCompleteCallback) {
		// Get the input filepath
		this.inputFile = input.trim();
		if (this.inputFile.length == 0) {
			throwError('empty_input_filepath');
		}
		// Check if file exist
		if (!existsSync(this.inputFile)) {
			throwError('file_input_not_exist');
		}

		// New instance of the base configuration
		var settings: FfmpegConfigs = {
			encoding: configs.encoding,
			maxBuffer: configs.maxBuffer,
			timeout: configs.timeout
		};
		if (typeof cfgOrCallback === "object") {
			settings = mergeObject(settings, cfgOrCallback);
		}

		// Callback to call
		let cb = typeof cfgOrCallback === "function" ? cfgOrCallback :
			(typeof inCallback === "function" ? inCallback : null);

		this.settings = settings;
		this.callback = cb;

		// Start video info asynchronous loading.
		this.getVideoInfo();

		// If first time, request supported modules too.
		if (Ffmpeg.supportedInfo === null) {
			Ffmpeg.getSupportedInfo(this.settings);
		}
	}

	/**
	 * Event invoked when loading of video info completed or failed.
	 * @param err The error got.
	 * @param video The video info decoded.
	 */
	private onVideoInfoGot(err: Error | null, video: MediaFileInfo | null) {
		this.initError = err;
		this.video = video;
		if (this.callback) {
			this.callback(err, video);
		}
		this.initialized = true;
	}

	/**
	 * Retrieves asynchronously the video info.
	 */
	private getVideoInfo() {
		// Make the call to retrieve information about the ffmpeg
		ffmpegRun([Ffmpeg.bin, '-i', this.inputFile], this.settings, null, (error, stdout, stderr) => {
			// On failure.
			if (error && (error.signal || error.killed)) {
				this.onVideoInfoGot(error, null);
				return;
			}
			stdout = stdout.concat(stderr);

			// Perse output for retrieve the file info
			var filename = /from \'(.*)\'/.exec(stdout) || [],
				title = /(INAM|title)\s+:\s(.+)/.exec(stdout) || [],
				artist = /artist\s+:\s(.+)/.exec(stdout) || [],
				album = /album\s+:\s(.+)/.exec(stdout) || [],
				track = /track\s+:\s(.+)/.exec(stdout) || [],
				date = /date\s+:\s(.+)/.exec(stdout) || [],
				is_synched = (/start: 0.000000/.exec(stdout) !== null),
				duration = /Duration: (([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(stdout) || [],

				container = /Input #0, ([a-zA-Z0-9]+),/.exec(stdout) || [],
				video_bitrate = /bitrate: ([0-9]+) kb\/s/.exec(stdout) || [],
				video_stream = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Video/.exec(stdout) || [],
				video_codec = /Video: ([\w]+)/.exec(stdout) || [],
				resolution = /(([0-9]{2,5})x([0-9]{2,5}))/.exec(stdout) || [],
				pixel = /[SP]AR ([0-9\:]+)/.exec(stdout) || [],
				aspect = /DAR ([0-9\:]+)/.exec(stdout) || [],
				fps = /([0-9\.]+) (fps|tb\(r\))/.exec(stdout) || [],

				audio_stream = /Stream #([0-9\.]+)([a-z0-9\(\)\[\]]*)[:] Audio/.exec(stdout) || [],
				audio_codec = /Audio: ([\w]+)/.exec(stdout) || [],
				sample_rate = /([0-9]+) Hz/i.exec(stdout) || [],
				channels = /Audio:.* (stereo|mono)/.exec(stdout) || [],
				audio_bitrate = /Audio:.* ([0-9]+) kb\/s/.exec(stdout) || [],
				rotate = /rotate[\s]+:[\s]([\d]{2,3})/.exec(stdout) || [];
			// Build return object
			var ret: MediaFileInfo = {
				filename: filename[1] || undefined,
				title: title[2] || undefined,
				artist: artist[1] || undefined,
				album: album[1] || undefined,
				track: track[1] || undefined,
				date: date[1] || undefined,
				synched: is_synched,
				duration: {
					raw: duration[1] || '',
					seconds: duration[1] ? durationToSeconds(duration[1]) : 0
				},
				video: {
					container: container[1] || undefined,
					bitrate: (video_bitrate.length > 1) ? parseInt(video_bitrate[1], 10) : 0,
					stream: video_stream.length > 1 ? parseFloat(video_stream[1]) : 0.0,
					codec: video_codec[1] || undefined,
					resolution: {
						w: resolution.length > 2 ? parseInt(resolution[2], 10) : 0,
						h: resolution.length > 3 ? parseInt(resolution[3], 10) : 0
					},
					resolutionSquare: undefined,
					aspect: undefined,
					rotate: rotate.length > 1 ? parseInt(rotate[1], 10) : 0,
					fps: fps.length > 1 ? parseFloat(fps[1]) : 0.0
				},
				audio: {
					codec: audio_codec[1] || undefined,
					bitrate: parseInt(audio_bitrate[1]) || undefined,
					sample_rate: sample_rate.length > 1 ? parseInt(sample_rate[1], 10) : 0,
					stream: audio_stream.length > 1 ? parseFloat(audio_stream[1]) : 0.0,
					channels: {
						raw: channels[1] || undefined,
						value: (channels.length > 0) ? ({ stereo: 2, mono: 1 }[channels[1]] || 0) : undefined
					}
				}
			};
			// Check if exist aspect ratio
			if (aspect.length > 0) {
				let aspectValue = aspect[1].split(":");
				const aspect_x = parseInt(aspectValue[0]);
				const aspect_y = parseInt(aspectValue[1]);
				ret.video.aspect = {
					x: aspect_x,
					y: aspect_y,
					label: aspect[1],
					value: (aspect_x / aspect_y)
				};
			} else {
				// If exists horizontal resolution then calculate aspect ratio
				if (ret.video.resolution.w > 0) {
					var gcdValue = gcd(ret.video.resolution.w, ret.video.resolution.h);
					// Calculate aspect ratio
					const aspect_x = ret.video.resolution.w / gcdValue;
					const aspect_y = ret.video.resolution.h / gcdValue;
					ret.video.aspect = {
						x: aspect_x,
						y: aspect_y,
						label: aspect_x + ':' + aspect_y,
						value: (aspect_x / aspect_y)
					};
				}
			}
			// Save pixel ratio for output size calculation
			if (pixel.length > 0) {
				ret.video.pixelString = pixel[1];
				var pixelValue = pixel[1].split(":");
				ret.video.pixel = (parseInt(pixelValue[0], 10) / parseInt(pixelValue[1], 10));
			} else {
				if (ret.video.resolution.w !== 0) {
					ret.video.pixelString = '1:1';
					ret.video.pixel = 1;
				} else {
					ret.video.pixelString = '';
					ret.video.pixel = 0.0;
				}
			}
			// Correct video.resolution when pixel aspect-ratio is not 1
			if (ret.video.pixel !== 1 && ret.video.pixel !== 0) {
				if (ret.video.pixel > 1) {
					ret.video.resolutionSquare = {
						w: ret.video.resolution.w * ret.video.pixel,
						h: ret.video.resolution.h
					};
				} else {
					ret.video.resolutionSquare = {
						w: ret.video.resolution.w,
						h: ret.video.resolution.h / ret.video.pixel
					};
				}
			}

			// Returns the retrieved video info.
			this.onVideoInfoGot(null, ret);
		});
	}

	/**
	 * Retrieves the supported formats, codecs and modules of currently configured ffmpeg instance.
	 * @param settings The setting used to invoke ffmpeg.
	 * @param callback Optional callback invoked on initialization success.
	 */
	public static getSupportedInfo(settings: FfmpegConfigs, callback?: (info:FfmpegSupportedInfo) => void) {
		ffmpegRun([Ffmpeg.bin, '-formats', '2>&1'], settings, null, (error, stdout) => {
			// On failure.
			if (error) {
				console.error("Unable to init ffmpeg supported info: ", error);
				return;
			}

			const format: { modules: string[], decode: string[], encode: string[] } = {
				modules: [],
				decode: [],
				encode: []
			};

			// Get the list of modules
			var configuration = /configuration:(.*)/.exec(stdout);
			// Check if exists the configuration
			if (configuration) {
				// Get the list of modules
				var modules = configuration[1].match(/--enable-([a-zA-Z0-9\-]+)/g) || [];
				// Scan all modules
				for (var indexModule in modules) {
					// Add module to the list
					let currModule = /--enable-([a-zA-Z0-9\-]+)/.exec(modules[indexModule]) || [];
					format.modules.push(currModule[1]);
				}
			}
			// Get the codec list
			var codecList = stdout.match(/ (DE|D|E) (.*) {1,} (.*)/g);
			// Scan all codec
			for (var i in codecList) {
				// Get the match value
				var match = / (DE|D|E) (.*) {1,} (.*)/.exec(codecList[i]);
				// Check if match is valid
				if (match) {
					// Get the value from the match
					var scope = match[1].replace(/\s/g, '')
						, extension = match[2].replace(/\s/g, '');
					// Check which scope is best suited
					if (scope == 'D' || scope == 'DE')
						format.decode.push(extension);
					if (scope == 'E' || scope == 'DE')
						format.encode.push(extension);
				}
			}

			// Returns the list of supported formats
			Ffmpeg.supportedInfo = new FfmpegSupportedInfo(format.modules, format.encode, format.decode);
			if(callback) {
				callback(Ffmpeg.supportedInfo);
			}
		});
	}

	/**
	 * Invokes the given callback when video info are ready.
	 * @param callback The callback to invoke.
	 */
	public onVideoInfoReady(callback: RetrieveInfoProcessCompleteCallback): void {
		if (this.initialized) {
			// Already initialized, invoke directly the input callback.
			callback(this.initError, this.video);
		} else {
			// Configure callback that will be invoked when done.
			this.callback = callback;
		}
	}

}
