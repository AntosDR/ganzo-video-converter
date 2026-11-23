/** Metadata extracted from an input media file for display and processing. */
export type MediaDescriptor = {
	path: string;
	name: string;
	extension: string;
	durationSeconds: number | null;
	container: string | null;
	videoCodec: string | null;
	resolution: string | null;
	audioCodec: string | null;
	audioBitrate: string | null;
};

/** Supported strategies for selecting frames from a video. */
export type FrameSamplingMode =
	| 'frameInterval'
	| 'timeInterval'
	| 'percentage'
	| 'frameRate'
	| 'frameCount';

/** Optional time range, size, and sampling parameters for JPG extraction. */
export type FrameSettings = {
	startSeconds?: number;
	durationSeconds?: number;
	size?: string;
	samplingMode?: FrameSamplingMode;
	samplingValue?: number;
};

/** Discriminated request sent to the main process to start an extraction. */
export type StartExtractionRequest =
	| { jobId: string; kind: 'audio-mp3' }
	| { jobId: string; kind: 'frames-jpg'; settings: FrameSettings };

/** Output format requested for an extraction job. */
export type ExtractionKind = StartExtractionRequest['kind'];

/** Output destination request associated with a unique extraction job. */
export type ChooseOutputRequest = {
	jobId: string;
	kind: ExtractionKind;
};

/** Progress update sent from the main process for an active job. */
export type ExtractionProgress = {
	jobId: string;
	percent: number | null;
	status: 'running';
};

/** Terminal result returned after an extraction completes or fails. */
export type ExtractionResult =
	| { status: 'success'; kind: 'audio-mp3'; outputPath: string }
	| {
			status: 'success';
			kind: 'frames-jpg';
			outputPath: string;
			outputFiles: string[];
	  }
	| { status: 'cancelled'; jobId: string }
	| { status: 'error'; message: string };
