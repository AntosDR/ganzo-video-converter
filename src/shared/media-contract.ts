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
	hasCover: boolean;
};

/** Supported output formats for audio extraction. */
export type AudioFormat = 'mp3' | 'aac' | 'wav' | 'flac' | 'ogg';

/** Supported bitrates for lossy audio extraction. */
export type AudioBitrate = '128k' | '192k' | '256k' | '320k';

/** Supported sample rates in Hz for audio extraction. */
export type AudioSampleRate = 44100 | 48000;

/** Parameters for extracting an audio stream to a standalone audio file. */
export type AudioExtractSettings = {
	format: AudioFormat;
	bitrate?: AudioBitrate;
	sampleRate?: AudioSampleRate;
};

/** Mode for combining a secondary audio file with a video's audio track. */
export type AudioMixMode = 'replace' | 'mix';

/** Parameters for replacing or mixing a video's audio track. */
export type AudioReplaceSettings = {
	audioPath: string;
	mode: AudioMixMode;
	offsetSeconds?: number;
};

/** Metadata for a secondary audio file chosen via the native picker. */
export type SelectedAudioFile = {
	path: string;
	name: string;
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

/** Discriminated request sent to the main process to start a media job. */
export type StartExtractionRequest =
	| { jobId: string; kind: 'audio-extract'; settings: AudioExtractSettings }
	| { jobId: string; kind: 'audio-replace'; settings: AudioReplaceSettings }
	| { jobId: string; kind: 'audio-mute' }
	| { jobId: string; kind: 'cover-jpg' }
	| { jobId: string; kind: 'frames-jpg'; settings: FrameSettings };

/** Output format requested for an extraction or processing job. */
export type ExtractionKind = StartExtractionRequest['kind'];

/** Output destination request associated with a unique extraction job. */
export type ChooseOutputRequest = {
	jobId: string;
	kind: ExtractionKind;
	format?: AudioFormat;
};

/** Progress update sent from the main process for an active job. */
export type ExtractionProgress = {
	jobId: string;
	percent: number | null;
	status: 'running';
};

/** Terminal result returned after a job completes, is cancelled, or fails. */
export type ExtractionResult =
	| {
			status: 'success';
			kind:
				'audio-extract' | 'audio-replace' | 'audio-mute' | 'cover-jpg';
			outputPath: string;
	  }
	| {
			status: 'success';
			kind: 'frames-jpg';
			outputPath: string;
			outputFiles: string[];
	  }
	| { status: 'cancelled'; jobId: string }
	| { status: 'error'; message: string };
