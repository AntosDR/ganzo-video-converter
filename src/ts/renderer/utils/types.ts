/*
 * Type definitions for object transferred trough context bridge.
 */


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
 * Data only of a decoded media file.
 */
export interface MediaFileData {
	readonly file_path: string;
	readonly metadata: MediaFileInfo;
};
