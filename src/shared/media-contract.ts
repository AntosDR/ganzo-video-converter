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

export type FrameSamplingMode =
  'frameInterval' | 'timeInterval' | 'percentage' | 'frameRate' | 'frameCount';

export type FrameSettings = {
  startSeconds?: number;
  durationSeconds?: number;
  size?: string;
  samplingMode?: FrameSamplingMode;
  samplingValue?: number;
};

export type StartExtractionRequest =
  | { jobId: string; kind: 'audio-mp3' }
  | { jobId: string; kind: 'frames-jpg'; settings: FrameSettings };

export type ExtractionKind = StartExtractionRequest['kind'];

export type ChooseOutputRequest = {
  jobId: string;
  kind: ExtractionKind;
};

export type ExtractionProgress = {
  jobId: string;
  percent: number | null;
  status: 'running';
};

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
