import { throwError } from "./errors";
import Ffmpeg, { FfmpegSupportedInfo, MediaFileInfo } from "./ffmpeg";

import * as utils from "./utils";
import * as presets from "./presets";
import { existsSync } from "fs";
import { ExecException } from "child_process";
import { FfmpegRunBuilder, FfmpegRunCompleteCallback } from "./process";

interface ProcessingOptions {
	audio?: {
		disabled?: boolean;
		codec?: string;
		frequency?: number;
		channel?: number;
		bitrate?: number;
		quality?: number;
	};
	video?: {
		disabled?: boolean;
		format?: string;
		codec?: string;
		bitrate?: number;
		framerate?: number;
		startTime?: number;
		duration?: number;
		aspect?: number;
		size?: string;
		keepPixelAspectRatio?: boolean;
		keepAspectRatio?: boolean;
		paddingColor?: string;
		watermark?: {
			path: string;
			overlay: string;
		};
	}
}

export type WatermarkSettings = {
	position?: "NE" | "NC" | "NW" | "SE" | "SC" | "SW" | "C" | "CE" | "CW";
	margin_nord?: null | number;
	margin_sud?: null | number;
	margin_east?: null | number;
	margin_west?: null | number;
}


export class MediaFile {

	// List of options generated from setting functions
	private options: ProcessingOptions = {};

	constructor(public readonly file_path: string,
		public readonly info_configuration: FfmpegSupportedInfo,
		public readonly metadata: MediaFileInfo) {
	}

	/**
	 * Initializes video options if required.
	 */
	private getVideoOpts() {
		if (this.options.video == undefined) {
			this.options.video = {};
		}
		return this.options.video;
	}

	/**
	 * Initializes audio options if required.
	 */
	private getAudioOpts() {
		if (this.options.audio == undefined) {
			this.options.audio = {};
		}
		return this.options.audio;
	}

	/**
	 * Disables audio encoding.
	 */
	public setDisableAudio(): this {
		// Set the new option
		this.getAudioOpts().disabled = true;
		return this;
	}

	/**
	 * Disables video encoding.
	 */
	public setDisableVideo(): this {
		// Set the new option
		this.getVideoOpts().disabled = true;
		return this;
	}

	/**
	 * Sets the new video format.
	 * @param format The new format to set.
	 */
	public setVideoFormat(format: string): this {
		// Check if the format is supported by ffmpeg version
		this.info_configuration.checkSupportedFormat(format);

		// Set the new option
		this.getVideoOpts().format = format;
		return this;
	}

	/**
	 * Sets the new audio codec.
	 * @param codec The new codec to set.
	 */
	public setVideoCodec(codec: string): this {
		// Check if the codec is supported by ffmpeg version
		this.info_configuration.checkSupportedCodec(codec);

		// Set the new option
		this.getVideoOpts().codec = codec;
		return this;
	}

	/**
	 * Sets the video bitrate
	 * @param bitrate The bit rate to set, in kb.
	 */
	public setVideoBitRate(bitrate: number): this {
		// Set the new option
		this.getVideoOpts().bitrate = bitrate;
		return this;
	}

	/**
	 * Sets the framerate of the video.
	 * @param framerate The new framerate to set.
	 */
	public setVideoFrameRate(framerate: number): this {
		// Set the new option
		this.getVideoOpts().framerate = framerate;
		return this;
	}

	/**
	 * Sets the start time.
	 * @param time The start time, expressed as duration object. 
	 */
	public setVideoStartTime(time: utils.Duration): this {
		// Set the new option
		this.getVideoOpts().startTime = time.durationSeconds;
		return this;
	}

	/**
	 * Sets the duration.
	 * @param duration The duration time, expressed as duration object. 
	 */
	public setVideoDuration(duration: utils.Duration): this {
		// Set the new option
		this.getVideoOpts().duration = duration.durationSeconds;
		return this;
	}

	/**
	 * Sets the new aspect ratio.
	 * @param aspect The aspect ratio to set, in the form `"xx:yy"`.
	 */
	public setVideoAspectRatio(aspect: string): this {
		let finalAspect = this.metadata.video.aspect ? this.metadata.video.aspect.value : undefined;
		// Check if aspect is a string
		if (aspect) {
			// Check if aspect is string xx:xx
			const check = /([0-9]+):([0-9]+)/.exec(aspect);
			if (check && check.length == 3) {
				const calcAspect = (parseFloat(check[1]) / parseFloat(check[2]));
				if (!isNaN(calcAspect)) {
					finalAspect = calcAspect;
				}
			}
		}

		// Set the new option
		this.getVideoOpts().aspect = finalAspect;
		return this;
	}

	/**
	 * Set the size of the video.
	 * For example, the video will be automatically resized to 640 pixels wide and will apply a padding white
	 * `video.setVideoSize('640x?', true, true, '#fff')`
	 * or, the video will be resized to 640x480 pixel, and if the aspect ratio is different the video will be stretched
	 * `video.setVideoSize('640x480', true, false)`
	 * @param size The video size, in the form `W x H`, where W or H can be a question mark `?`.
	 * @param keepPixelAspectRatio Keeps pixel aspect ratio.
	 * @param keepAspectRatio Keeps aspect ratio, or pad with padding color.
	 * @param paddingColor The color to use for padding, in the form `#RGB`.
	 */
	public setVideoSize(size: string, keepPixelAspectRatio: boolean, keepAspectRatio: boolean, paddingColor?: string): this {
		if (!/([0-9]|\?+)x([0-9]|\?+)/.test(size)) {
			throwError("size_format", size);
		}

		// Set the new option
		let video = this.getVideoOpts();
		video.size = size;
		video.keepPixelAspectRatio = keepPixelAspectRatio;
		video.keepAspectRatio = keepAspectRatio;
		video.paddingColor = paddingColor;
		return this;
	}

	/**
	 * Sets the new audio codec.
	 * @param codec The codec to set.
	 */
	public setAudioCodec(codec: string): this {
		// Check if the codec is supported by ffmpeg version
		this.info_configuration.checkSupportedCodec(codec);

		// Check if codec is equal 'MP3' and check if the version of ffmpeg support the libmp3lame function
		if (codec == 'mp3' && this.info_configuration.modules.indexOf('libmp3lame') != -1) {
			codec = 'libmp3lame';
		}

		// Set the new option
		this.getAudioOpts().codec = codec;
		return this;
	}

	/**
	 * Sets the audio sample frequency for audio outputs.
	 * @param frequency The frequency to set.
	 */
	public setAudioFrequency(frequency: number): this {
		// Set the new option
		this.getAudioOpts().frequency = frequency;
		return this;
	}

	/**
	 * Sets the number of audio channels.
	 * @param channel The new channel value to set.
	 */
	public setAudioChannels(channel: number): this {
		// Check if the channel value is valid
		if (presets.audio_channel.stereo == channel || presets.audio_channel.mono == channel) {
			// Set the new option
			this.getAudioOpts().channel = channel;
			return this;
		} else {
			throwError('audio_channel_is_invalid', channel.toString());
		}
	}

	/**
	 * Sets the audio bitrate.
	 * @param bitrate The new bitrate to set.
	 */
	public setAudioBitRate(bitrate: number): this {
		// Set the new option
		this.getAudioOpts().bitrate = bitrate;
		return this;
	}

	/**
	 * Sets the audio quality.
	 * @param quality The new quality value to set.
	 */
	public setAudioQuality(quality: number): this {
		// Set the new option
		this.getAudioOpts().quality = quality;
		return this;
	}

	/**
	 * Sets the watermark.
	 * @param watermarkPath The path to the watermark image.
	 * @param settings The optional settings.
	 */
	public setWatermark(watermarkPath: string, settings?: WatermarkSettings): this {
		// Base settings
		var baseSettings: WatermarkSettings = {
			position: "SW",		// Position: NE NC NW SE SC SW C CE CW
			margin_nord: null,		// Margin nord
			margin_sud: null,		// Margin sud
			margin_east: null,		// Margin east
			margin_west: null		// Margin west
		};

		// Check if watermark exists
		if (!existsSync(watermarkPath)) {
			throwError('invalid_watermark', watermarkPath);
		}

		// Check if the settings are specified
		if (settings != null) {
			utils.mergeObject(baseSettings, settings);
		}

		// Check if position is valid
		if (baseSettings.position == null || utils.in_array(baseSettings.position, ['NE', 'NC', 'NW', 'SE', 'SC', 'SW', 'C', 'CE', 'CW']) === false) {
			throwError('invalid_watermark_position', baseSettings.position);
		}

		// Check if margins are valid
		if (baseSettings.margin_nord === null || baseSettings.margin_nord === undefined || isNaN(baseSettings.margin_nord))
			baseSettings.margin_nord = 0;
		if (baseSettings.margin_sud === null || baseSettings.margin_sud === undefined || isNaN(baseSettings.margin_sud))
			baseSettings.margin_sud = 0;
		if (baseSettings.margin_east === null || baseSettings.margin_east === undefined || isNaN(baseSettings.margin_east))
			baseSettings.margin_east = 0;
		if (baseSettings.margin_west === null || baseSettings.margin_west === undefined || isNaN(baseSettings.margin_west))
			baseSettings.margin_west = 0;

		var overlay = '';

		const getSing = function (val: number, inverse: boolean) {
			return (val > 0 ? (inverse ? '-' : '+') : (inverse ? '+' : '-')).toString() + Math.abs(val).toString();
		}

		const getHorizontalMargins = function (east: number, west: number) {
			return getSing(east, false).toString() + getSing(west, true).toString();
		}

		const getVerticalMargins = function (nord: number, sud: number) {
			return getSing(nord, false).toString() + getSing(sud, true).toString();
		}

		// Calculate formula
		switch (baseSettings.position) {
			case 'NE':
				overlay = '0' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':0' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'NC':
				overlay = 'main_w/2-overlay_w/2' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':0' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'NW':
				overlay = 'main_w-overlay_w' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':0' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'SE':
				overlay = '0' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h-overlay_h' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'SC':
				overlay = 'main_w/2-overlay_w/2' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h-overlay_h' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'SW':
				overlay = 'main_w-overlay_w' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h-overlay_h' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'CE':
				overlay = '0' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h/2-overlay_h/2' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'C':
				overlay = 'main_w/2-overlay_w/2' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h/2-overlay_h/2' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
			case 'CW':
				overlay = 'main_w-overlay_w' + getHorizontalMargins(baseSettings.margin_east, baseSettings.margin_west) + ':main_h/2-overlay_h/2' + getVerticalMargins(baseSettings.margin_nord, baseSettings.margin_sud);
				break;
		}

		// Set the new option
		this.getVideoOpts().watermark = { path: watermarkPath, overlay: overlay };
		return this;
	}

	/**
	 * Save all set commands.
	 * @param destinationFileName The destination file name.
	 * @param callback The callback to invoke on completion.
	 * @param customCommands Optional function which adds custom commands to the process command line.
	 */
	public save(destinationFileName: string, callback: FfmpegRunCompleteCallback,
		customCommands?: (cmdBuilder: FfmpegRunBuilder) => void) {
		// Creates a command builder.
		const cmd_builder = new FfmpegRunBuilder(Ffmpeg.bin);
		cmd_builder.addInput(this.file_path);

		// Check if the 'video' is present in the options
		if (this.options.video) {
			// Check if video is disabled
			if (this.options.video.disabled) {
				cmd_builder.addCommand('-vn');
			} else {
				// Check all video property
				if (this.options.video.format) {
					cmd_builder.addCommand('-f', this.options.video.format);
				}
				if (this.options.video.codec) {
					cmd_builder.addCommand('-vcodec', this.options.video.codec);
				}
				if (this.options.video.bitrate) {
					cmd_builder.addCommand('-b', this.options.video.bitrate + 'kb');
				}
				if (this.options.video.framerate) {
					cmd_builder.addCommand('-r', this.options.video.framerate);
				}
				if (this.options.video.startTime) {
					cmd_builder.addCommand('-ss', this.options.video.startTime);
				}
				if (this.options.video.duration) {
					cmd_builder.addCommand('-t', this.options.video.duration);
				}

				if (this.options.video.watermark) {
					cmd_builder.addInput(this.options.video.watermark.path);
					cmd_builder.addFilterComplex('overlay=' + this.options.video.watermark.overlay);
				}

				// Check if the video should be scaled
				if (this.options.video.size) {
					var newDimension = this.calculateNewDimension();

					if (newDimension.aspect != null) {
						cmd_builder.addFilterComplex('scale=iw*sar:ih, ' +
							'pad=max(iw\\,ih*(' + newDimension.aspect.x + '/' + newDimension.aspect.y + ')):' +
							'ow/(' + newDimension.aspect.x + '/' + newDimension.aspect.y + '):' +
							'(ow-iw)/2:(oh-ih)/2' + (this.options.video.paddingColor != null ? ':' + this.options.video.paddingColor : ''));
						cmd_builder.addCommand('-aspect', newDimension.aspect.string);
					}

					cmd_builder.addCommand('-s', newDimension.width + 'x' + newDimension.height);
				}
			}
		}
		// Check if the 'audio' is present in the options
		if (this.options.audio) {
			// Check if audio is disabled
			if (this.options.audio.disabled) {
				cmd_builder.addCommand('-an');
			} else {
				// Check all audio property
				if (this.options.audio.codec)
					cmd_builder.addCommand('-acodec', this.options.audio.codec);
				if (this.options.audio.frequency)
					cmd_builder.addCommand('-ar', this.options.audio.frequency);
				if (this.options.audio.channel)
					cmd_builder.addCommand('-ac', this.options.audio.channel);
				if (this.options.audio.quality)
					cmd_builder.addCommand('-aq', this.options.audio.quality);
				if (this.options.audio.bitrate)
					cmd_builder.addCommand('-ab', this.options.audio.bitrate + 'k');
			}
		}

		cmd_builder.setOutput(destinationFileName);

		// Customization of the command line.
		if (customCommands) {
			customCommands(cmd_builder);
		}

		return cmd_builder.execute(callback, destinationFileName);
	}

	/**
	 * Calculate width, height and aspect ratio by the new dimension data.
	 * @returns The new dimension data.
	 */
	public calculateNewDimension() {
		if (!this.options.video) {
			throwError("resolution_square_not_defined");
		}

		// Check if keepPixelAspectRatio is undefined
		let keepPixelAspectRatio = typeof this.options.video.keepPixelAspectRatio != 'boolean' ? false : this.options.video.keepPixelAspectRatio;
		// Check if keepAspectRatio is undefined
		let keepAspectRatio = typeof this.options.video.keepAspectRatio != 'boolean' ? false : this.options.video.keepAspectRatio;

		// Resolution to be taken as a reference
		let referrerResolution = this.metadata.video.resolution;
		// Check if is need keep pixel aspect ratio
		if (keepPixelAspectRatio) {
			// Check if exists resolution for pixel aspect ratio
			if (!this.metadata.video.resolutionSquare) {
				throwError('resolution_square_not_defined');
			}

			// Apply the resolutionSquare
			referrerResolution = this.metadata.video.resolutionSquare;
		}

		if (!this.options.video.size) {
			throwError('size_format', this.options.video.size);
		}

		// Final data
		let width = null, height = null, aspect = null;

		// Regex to check which type of dimension was specified
		const fixedWidth = /([0-9]+)x\?/.exec(this.options.video.size);
		const fixedHeight = /\?x([0-9]+)/.exec(this.options.video.size);
		const percentage = /([0-9]{1,2})%/.exec(this.options.video.size);
		const classicSize = /([0-9]+)x([0-9]+)/.exec(this.options.video.size);

		if (fixedWidth) {
			// Set the width dimension
			width = parseInt(fixedWidth[1], 10);
			// Check if the video has the aspect ratio set
			if (this.metadata.video.aspect) {
				height = Math.round((width / this.metadata.video.aspect.x) * this.metadata.video.aspect.y);
			} else {
				// Calculate the new height
				height = Math.round(referrerResolution.h / (referrerResolution.w / parseInt(fixedWidth[1], 10)));
			}
		} else if (fixedHeight) {
			// Set the width dimension
			height = parseInt(fixedHeight[1], 10);
			// Check if the video has the aspect ratio set
			if (this.metadata.video.aspect) {
				width = Math.round((height / this.metadata.video.aspect.y) * this.metadata.video.aspect.x);
			} else {
				// Calculate the new width
				width = Math.round(referrerResolution.w / (referrerResolution.h / parseInt(fixedHeight[1], 10)));
			}
		} else if (percentage) {
			// Calculate the ratio from percentage
			var ratio = parseInt(percentage[1], 10) / 100;
			// Calculate the new dimensions
			width = Math.round(referrerResolution.w * ratio);
			height = Math.round(referrerResolution.h * ratio);
		} else if (classicSize) {
			width = parseInt(classicSize[1], 10);
			height = parseInt(classicSize[2], 10);
		} else {
			throwError('size_format', this.options.video.size);
		}

		// If the width or height are not multiples of 2 will be decremented by one unit
		if (width % 2 != 0) width -= 1;
		if (height % 2 != 0) height -= 1;

		if (keepAspectRatio) {
			// Calculate the new aspect ratio
			const gcdValue = utils.gcd(width, height);
			const aspect_x = width / gcdValue;
			const aspect_y = height / gcdValue;

			aspect = {
				x: aspect_x,
				y: aspect_y,
				string: aspect_x + ':' + aspect_y
			};
		};

		return { width: width, height: height, aspect: aspect };
	}

}
