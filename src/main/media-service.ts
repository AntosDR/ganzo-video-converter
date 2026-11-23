import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { dialog, BrowserWindow, shell, WebContents } from 'electron';
import {
  FrameSettings,
  MediaDescriptor,
  ExtractionKind,
  StartExtractionRequest,
  ExtractionResult,
} from '../shared/media-contract';

const VIDEO_EXTENSIONS = new Set([
  'webm',
  'mkv',
  'flv',
  'vob',
  'ogv',
  'ogg',
  'gif',
  'gifv',
  'mng',
  'avi',
  'mts',
  'm2ts',
  'ts',
  'mov',
  'qt',
  'wmv',
  'yuv',
  'rm',
  'rmvb',
  'viv',
  'asf',
  'amv',
  'mp4',
  'm4p',
  'm4v',
  'mpg',
  'mp2',
  'mpeg',
  'mpe',
  'mpv',
  'm2v',
  'svi',
  '3gp',
  '3g2',
  'mxf',
  'roq',
  'nsv',
  'f4v',
  'f4p',
  'f4a',
  'f4b',
]);
const AUDIO_EXTENSIONS = new Set([
  '3gp',
  'aa',
  'aac',
  'aax',
  'act',
  'aiff',
  'alac',
  'amr',
  'ape',
  'au',
  'awb',
  'dss',
  'dvf',
  'flac',
  'gsm',
  'iklax',
  'ivs',
  'm4a',
  'm4b',
  'm4p',
  'mmf',
  'mp3',
  'mpc',
  'msv',
  'nmf',
  'ogg',
  'oga',
  'mogg',
  'opus',
  'org',
  'ra',
  'rm',
  'raw',
  'rf64',
  'sln',
  'tta',
  'voc',
  'vox',
  'wav',
  'wma',
  'wv',
  'webm',
  '8svx',
  'cda',
]);

type Job = {
  id: string;
  sender: WebContents;
  process: ChildProcessWithoutNullStreams;
  kind: 'audio-mp3' | 'frames-jpg';
  outputs: string[];
  outputDirectory?: string;
  aborted: boolean;
  existingFrameFiles: Set<string>;
};

export function validateFrameSettings(
  settings: FrameSettings | undefined,
  mediaDuration?: number | null,
): string | null {
  if (!settings) return 'JPG frame settings are required.';
  if (
    settings.startSeconds != null &&
    (settings.startSeconds < 0 || !Number.isFinite(settings.startSeconds))
  )
    return 'Start time must be zero or a positive number.';
  if (
    settings.durationSeconds != null &&
    (settings.durationSeconds <= 0 ||
      !Number.isFinite(settings.durationSeconds))
  )
    return 'Duration must be a positive number.';
  if (settings.size && !/^\d{2,5}x\d{2,5}$/i.test(settings.size))
    return 'Output size must use WIDTHxHEIGHT, for example 1280x720.';
  if (settings.samplingMode) {
    if (
      settings.samplingValue == null ||
      !Number.isFinite(settings.samplingValue) ||
      settings.samplingValue <= 0
    )
      return 'Sampling value must be a positive number.';
  }
  if (
    settings.samplingMode === 'percentage' &&
    settings.samplingValue != null &&
    settings.samplingValue > 100
  )
    return 'Percentage sampling must be between 0 and 100.';
  if (
    settings.samplingMode === 'percentage' &&
    settings.samplingValue != null &&
    settings.samplingValue <= 100 &&
    settings.samplingValue > 0 &&
    (mediaDuration == null || mediaDuration <= 0)
  )
    return 'Percentage sampling requires a known media duration.';
  return null;
}

export function isValidJobId(jobId: unknown): jobId is string {
  return typeof jobId === 'string' && /^job-[A-Za-z0-9_-]{4,80}$/.test(jobId);
}

export class MediaService {
  private selected: { path: string; metadata: MediaDescriptor } | null = null;
  private activeJob: Job | null = null;
  private pendingDestination: {
    jobId: string;
    kind: ExtractionKind;
    path: string;
  } | null = null;
  private completedJobs = new Map<
    string,
    {
      kind: Job['kind'];
      outputs: string[];
      directory?: string;
      sender: WebContents;
    }
  >();

  constructor(private ffmpegPath: string) {}

  getSelected() {
    return this.selected?.metadata ?? null;
  }

  clearSelection() {
    if (this.activeJob)
      throw new Error('Cannot change media during extraction.');
    this.selected = null;
    this.pendingDestination = null;
  }

  async inspect(filePath: string): Promise<MediaDescriptor> {
    if (!filePath || typeof filePath !== 'string')
      throw new Error('No input file was provided.');
    const extension = path.extname(filePath).slice(1).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(extension) && !AUDIO_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported media type ".${extension || 'unknown'}".`);
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error('The selected file does not exist or is not readable.');
    }

    const output = await this.runInspection(filePath);
    if (!output.ok)
      throw new Error(output.error || 'FFmpeg could not inspect this media.');

    const durationMatch = output.text.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    const durationSeconds = durationMatch
      ? Number(durationMatch[1]) * 3600 +
        Number(durationMatch[2]) * 60 +
        Number(durationMatch[3])
      : null;
    const videoLine = output.text.match(
      /Video:\s*([^\s,]+)[^\n]*(?:, \d+x\d+)?/i,
    );
    const resolution = output.text.match(/,\s*(\d{2,5}x\d{2,5})/)?.[1] ?? null;
    const audioLine = output.text.match(/Audio:\s*([^\s,]+)/i);
    const bitrateMatch = output.text.match(/,\s*(\d+\s*kb\/s)/i);
    const descriptor: MediaDescriptor = {
      path: filePath,
      name: path.basename(filePath),
      extension,
      durationSeconds,
      container: extension || null,
      videoCodec: videoLine?.[1] ?? null,
      resolution,
      audioCodec: audioLine?.[1] ?? null,
      audioBitrate: bitrateMatch?.[1]?.replace(/\s+/g, ' ') ?? null,
    };
    this.selected = { path: filePath, metadata: descriptor };
    this.pendingDestination = null;
    return descriptor;
  }

  private runInspection(
    filePath: string,
  ): Promise<{ ok: boolean; text: string; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn(this.ffmpegPath, ['-hide_banner', '-i', filePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let text = '';
      let errorText = '';
      child.stdout.on('data', (data) => {
        text += data.toString();
      });
      child.stderr.on('data', (data) => {
        text += data.toString();
        errorText += data.toString();
      });
      child.on('error', (error) =>
        resolve({ ok: false, text: '', error: error.message }),
      );
      child.on('close', (code) => {
        const known = /Duration:/.test(text);
        resolve(
          known
            ? { ok: true, text }
            : {
                ok: false,
                text,
                error: errorText || `FFmpeg exited with code ${code}`,
              },
        );
      });
    });
  }

  async selectMedia(window: BrowserWindow): Promise<MediaDescriptor | null> {
    const result = await dialog.showOpenDialog(window, {
      title: 'Select a media file',
      properties: ['openFile'],
      filters: [
        {
          name: 'Audio and video files',
          extensions: [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS],
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return this.inspect(result.filePaths[0]);
  }

  async chooseOutput(
    window: BrowserWindow,
    jobId: string,
    kind: ExtractionKind,
  ): Promise<string | null> {
    if (!this.selected)
      throw new Error('Select media before choosing an output destination.');
    if (!isValidJobId(jobId)) throw new Error('Invalid output selection ID.');
    if (kind !== 'audio-mp3' && kind !== 'frames-jpg')
      throw new Error('Unsupported output type.');
    if (this.activeJob)
      throw new Error('Cannot change output during extraction.');

    let destination: string | null = null;
    if (kind === 'audio-mp3') {
      const picked = await dialog.showSaveDialog(window, {
        title: 'Choose MP3 destination',
        defaultPath: `${path.basename(this.selected.path, path.extname(this.selected.path))}.mp3`,
        filters: [{ name: 'MP3 audio', extensions: ['mp3'] }],
      });
      if (!picked.canceled && picked.filePath) {
        const selectedPath = path.parse(picked.filePath);
        destination = path.join(selectedPath.dir, `${selectedPath.name}.mp3`);
      }
    } else {
      const picked = await dialog.showOpenDialog(window, {
        title: 'Choose JPG output folder',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (!picked.canceled && picked.filePaths.length > 0)
        destination = picked.filePaths[0];
    }

    if (destination)
      this.pendingDestination = { jobId, kind, path: destination };
    return destination;
  }

  async start(
    window: BrowserWindow,
    sender: WebContents,
    request: StartExtractionRequest,
    onProgress: (percent: number | null) => void,
  ): Promise<ExtractionResult> {
    if (!this.selected)
      return { status: 'error', message: 'No input media is selected.' };
    if (!isValidJobId(request?.jobId))
      return { status: 'error', message: 'Invalid job ID.' };
    if (
      this.completedJobs.has(request.jobId) ||
      this.activeJob?.id === request.jobId
    )
      return { status: 'error', message: 'Duplicate or expired job ID.' };
    if (this.activeJob)
      return {
        status: 'error',
        message: 'Another extraction is already running.',
      };

    if (request.kind === 'frames-jpg') {
      const validation = validateFrameSettings(
        request.settings,
        this.selected.metadata.durationSeconds,
      );
      if (validation) return { status: 'error', message: validation };
    }

    const selection = this.pendingDestination;
    if (
      !selection ||
      selection.jobId !== request.jobId ||
      selection.kind !== request.kind
    )
      return {
        status: 'error',
        message: 'Choose a matching output destination before extraction.',
      };
    this.pendingDestination = null;
    return this.runJob(window, sender, request, selection.path, onProgress);
  }

  private runJob(
    window: BrowserWindow,
    sender: WebContents,
    request: StartExtractionRequest,
    destination: string,
    onProgress: (percent: number | null) => void,
  ): Promise<ExtractionResult> {
    return new Promise((resolve) => {
      const args =
        request.kind === 'audio-mp3'
          ? [
              '-hide_banner',
              '-y',
              '-i',
              this.selected!.path,
              '-vn',
              '-ac',
              '2',
              '-ar',
              '44100',
              '-b:a',
              '192k',
              '-c:a',
              'libmp3lame',
              destination,
            ]
          : this.frameArgs(destination, request.settings);

      let stderr = '';
      const process = spawn(this.ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const job: Job = {
        id: request.jobId,
        sender,
        process,
        kind: request.kind,
        outputs: request.kind === 'audio-mp3' ? [destination] : [],
        outputDirectory:
          request.kind === 'frames-jpg' ? destination : undefined,
        aborted: false,
        existingFrameFiles:
          request.kind === 'frames-jpg' && fs.existsSync(destination)
            ? new Set(
                fs
                  .readdirSync(destination)
                  .filter((name) => /^frame-\d{6}\.jpg$/i.test(name))
                  .map((name) => path.join(destination, name)),
              )
            : new Set(),
      };
      this.activeJob = job;

      process.stderr.on('data', (data) => {
        stderr += data.toString();
        const time = stderr.slice(-4000).match(/time=(\d+):(\d+):([\d.]+)/);
        if (time) {
          const seconds =
            Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]);
          const duration = this.selected?.metadata.durationSeconds;
          onProgress(
            duration
              ? Math.min(100, Math.max(0, (seconds / duration) * 100))
              : null,
          );
        } else {
          onProgress(null);
        }
      });

      process.on('error', (error) => {
        if (this.activeJob === job) this.activeJob = null;
        resolve({ status: 'error', message: error.message });
      });

      process.on('close', (code) => {
        if (this.activeJob === job) this.activeJob = null;
        if (job.aborted) {
          this.removePartialOutputs(job);
          resolve({ status: 'cancelled', jobId: request.jobId });
          return;
        }
        if (code !== 0) {
          resolve({
            status: 'error',
            message: stderr.trim() || `FFmpeg exited with code ${code}.`,
          });
          return;
        }

        if (request.kind === 'audio-mp3') {
          if (
            !fs.existsSync(destination) ||
            fs.statSync(destination).size === 0
          ) {
            resolve({
              status: 'error',
              message: 'FFmpeg completed without producing the MP3 output.',
            });
            return;
          }
          job.outputs = [destination];
          this.completedJobs.set(request.jobId, {
            kind: 'audio-mp3',
            outputs: job.outputs,
            sender,
          });
          resolve({
            status: 'success',
            kind: 'audio-mp3',
            outputPath: destination,
          });
        } else {
          const files = fs.existsSync(destination)
            ? fs
                .readdirSync(destination)
                .filter((name) => /\.jpe?g$/i.test(name))
                .map((name) => path.join(destination, name))
                .filter((file) => !job.existingFrameFiles.has(file))
                .filter((file) => fs.statSync(file).size > 0)
            : [];
          if (files.length === 0) {
            resolve({
              status: 'error',
              message: 'FFmpeg completed without producing any JPG frames.',
            });
            return;
          }
          job.outputs = files;
          this.completedJobs.set(request.jobId, {
            kind: 'frames-jpg',
            outputs: files,
            directory: destination,
            sender,
          });
          resolve({
            status: 'success',
            kind: 'frames-jpg',
            outputPath: destination,
            outputFiles: files,
          });
        }
      });
    });
  }

  private frameArgs(destination: string, settings: FrameSettings): string[] {
    const args = ['-hide_banner', '-y', '-i', this.selected!.path];
    if (settings.startSeconds != null)
      args.push('-ss', String(settings.startSeconds));
    if (settings.durationSeconds != null)
      args.push('-t', String(settings.durationSeconds));
    const filters: string[] = [];
    if (settings.size) filters.push(`scale=${settings.size.replace('x', ':')}`);
    switch (settings.samplingMode) {
      case 'frameInterval':
        filters.push(`select=not(mod(n\\,${settings.samplingValue}))`);
        break;
      case 'timeInterval':
        filters.push(`fps=1/${settings.samplingValue}`);
        break;
      case 'percentage':
        filters.push(
          `select=not(mod(t\\,${((this.selected!.metadata.durationSeconds! * Number(settings.samplingValue!)) / 100).toFixed(6)}))`,
        );
        break;
      case 'frameRate':
        filters.push(`fps=${settings.samplingValue}`);
        break;
      case 'frameCount':
        break;
    }
    if (
      settings.samplingMode === 'frameInterval' ||
      settings.samplingMode === 'timeInterval' ||
      settings.samplingMode === 'percentage'
    ) {
      args.push('-vsync', '0');
    }
    if (filters.length) args.push('-vf', filters.join(','));
    if (settings.samplingMode === 'frameCount') {
      args.push('-frames:v', String(settings.samplingValue));
    }
    args.push('-q:v', '2', path.join(destination, 'frame-%06d.jpg'));
    return args;
  }

  abort(sender: WebContents, jobId: string): void {
    if (!isValidJobId(jobId)) throw new Error('Invalid extraction job ID.');
    if (!this.activeJob || this.activeJob.id !== jobId)
      throw new Error('Unknown or inactive extraction job.');
    if (this.activeJob.sender !== sender)
      throw new Error('Unknown or foreign extraction job.');
    this.activeJob.aborted = true;
    this.activeJob.process.kill('SIGKILL');
  }

  reveal(sender: WebContents, jobId: string): void {
    if (!isValidJobId(jobId)) throw new Error('Invalid extraction job ID.');
    const completed = this.completedJobs.get(jobId);
    if (!completed || completed.sender !== sender)
      throw new Error('Unknown or foreign extraction job.');
    const output =
      completed.kind === 'frames-jpg'
        ? completed.directory || completed.outputs[0]
        : completed.outputs[0];
    if (!output || !fs.existsSync(output))
      throw new Error('The completed output no longer exists.');
    if (completed.kind === 'frames-jpg') shell.openPath(output);
    else shell.showItemInFolder(output);
  }

  private removePartialOutputs(job: Job) {
    for (const file of job.outputs) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {
        /* ignore cleanup errors */
      }
    }
    if (job.outputDirectory && fs.existsSync(job.outputDirectory)) {
      for (const name of fs.readdirSync(job.outputDirectory)) {
        if (!/^frame-\d{6}\.jpg$/i.test(name)) continue;
        const file = path.join(job.outputDirectory, name);
        if (job.existingFrameFiles.has(file)) continue;
        try {
          fs.unlinkSync(file);
        } catch {
          /* ignore cleanup errors */
        }
      }
    }
  }
}
