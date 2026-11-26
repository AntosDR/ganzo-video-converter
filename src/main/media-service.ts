import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { dialog, BrowserWindow, shell, WebContents } from 'electron';
import {
	AudioBitrate,
	AudioExtractSettings,
	AudioFormat,
	AudioReplaceSettings,
	AudioSampleRate,
	ExtractionKind,
	ExtractionResult,
	FrameSettings,
	MediaDescriptor,
	SelectedAudioFile,
	StartExtractionRequest,
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

const AUDIO_FORMAT_INFO: Record<
	AudioFormat,
	{ label: string; codec: string; lossy: boolean }
> = {
	mp3: { label: 'MP3 audio', codec: 'libmp3lame', lossy: true },
	aac: { label: 'AAC audio', codec: 'aac', lossy: true },
	wav: { label: 'WAV audio', codec: 'pcm_s16le', lossy: false },
	flac: { label: 'FLAC audio', codec: 'flac', lossy: false },
	ogg: { label: 'OGG audio', codec: 'libvorbis', lossy: true },
};

const VALID_BITRATES = new Set<AudioBitrate>(['128k', '192k', '256k', '320k']);
const VALID_SAMPLE_RATES = new Set<AudioSampleRate>([44100, 48000]);

type Job = {
	id: string;
	sender: WebContents;
	process: ChildProcessWithoutNullStreams;
	kind: ExtractionKind;
	outputs: string[];
	outputDirectory?: string;
	aborted: boolean;
	existingFrameFiles: Set<string>;
};

/**
 * Validates audio extraction settings against supported formats, bitrates, and sample rates.
 *
 * @returns A user-facing validation message, or `null` when the settings are valid.
 */
export function validateAudioExtractSettings(
	settings: AudioExtractSettings | undefined,
): string | null {
	if (
		!settings ||
		!settings.format ||
		!(settings.format in AUDIO_FORMAT_INFO)
	)
		return 'Choose a valid audio output format.';
	if (settings.bitrate != null && !VALID_BITRATES.has(settings.bitrate))
		return 'Choose a valid audio bitrate.';
	if (
		settings.sampleRate != null &&
		!VALID_SAMPLE_RATES.has(settings.sampleRate)
	)
		return 'Choose a valid audio sample rate.';
	return null;
}

/**
 * Validates audio replacement or mixing settings, including the secondary audio file path.
 *
 * @returns A user-facing validation message, or `null` when the settings are valid.
 */
export function validateAudioReplaceSettings(
	settings: AudioReplaceSettings | undefined,
	hasSourceAudio = true,
): string | null {
	if (!settings) return 'Audio replacement settings are required.';
	if (!settings.audioPath || typeof settings.audioPath !== 'string')
		return 'Choose an audio file to replace or mix.';
	const extension = path.extname(settings.audioPath).slice(1).toLowerCase();
	if (!AUDIO_EXTENSIONS.has(extension))
		return `Unsupported audio file type ".${extension || 'unknown'}".`;
	if (
		!fs.existsSync(settings.audioPath) ||
		!fs.statSync(settings.audioPath).isFile()
	)
		return 'The selected audio file does not exist or is not readable.';
	if (settings.mode !== 'replace' && settings.mode !== 'mix')
		return 'Choose replace or mix mode.';
	if (settings.mode === 'mix' && !hasSourceAudio)
		return 'Mixing requires a source video with an existing audio track.';
	if (
		settings.offsetSeconds != null &&
		(!Number.isFinite(settings.offsetSeconds) || settings.offsetSeconds < 0)
	)
		return 'Audio offset must be zero or a positive number.';
	return null;
}

/**
 * Validates JPG extraction settings against their supported ranges.
 *
 * @returns A user-facing validation message, or `null` when the settings are valid.
 */
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

/** Type guard for opaque IDs accepted by extraction IPC handlers. */
export function isValidJobId(jobId: unknown): jobId is string {
	return typeof jobId === 'string' && /^job-[A-Za-z0-9_-]{4,80}$/.test(jobId);
}

/** Owns media selection, FFmpeg jobs, and their output destinations. */
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

	/** Creates the service using the resolved FFmpeg executable path. */
	constructor(private ffmpegPath: string) {}

	/** Returns the metadata for the currently selected media, if any. */
	getSelected() {
		return this.selected?.metadata ?? null;
	}

	/** Clears the media and destination selection when no extraction is running. */
	clearSelection() {
		if (this.activeJob)
			throw new Error('Cannot change media during extraction.');
		this.selected = null;
		this.pendingDestination = null;
	}

	/** Validates and probes an audio or video file, then stores its metadata. */
	async inspect(filePath: string): Promise<MediaDescriptor> {
		if (!filePath || typeof filePath !== 'string')
			throw new Error('No input file was provided.');
		const extension = path.extname(filePath).slice(1).toLowerCase();
		if (
			!VIDEO_EXTENSIONS.has(extension) &&
			!AUDIO_EXTENSIONS.has(extension)
		) {
			throw new Error(
				`Unsupported media type ".${extension || 'unknown'}".`,
			);
		}
		if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
			throw new Error(
				'The selected file does not exist or is not readable.',
			);
		}

		const output = await this.runInspection(filePath);
		if (!output.ok)
			throw new Error(
				output.error || 'FFmpeg could not inspect this media.',
			);

		const durationMatch = output.text.match(
			/Duration:\s*(\d+):(\d+):([\d.]+)/,
		);
		const durationSeconds = durationMatch
			? Number(durationMatch[1]) * 3600 +
				Number(durationMatch[2]) * 60 +
				Number(durationMatch[3])
			: null;
		const videoLine = output.text.match(
			/Video:\s*([^\s,]+)[^\n]*(?:, \d+x\d+)?/i,
		);
		const resolutionMatch = output.text.match(/,\s*(\d{2,5}x\d{2,5})/);
		const audioLine = output.text.match(/Audio:\s*([^\s,]+)/i);
		const bitrateMatch = output.text.match(/,\s*(\d+\s*kb\/s)/i);
		const isAudioOnlyContainer =
			AUDIO_EXTENSIONS.has(extension) && !VIDEO_EXTENSIONS.has(extension);
		const hasCover =
			/attached pic/i.test(output.text) ||
			(isAudioOnlyContainer && videoLine != null);
		const descriptor: MediaDescriptor = {
			path: filePath,
			name: path.basename(filePath),
			extension,
			durationSeconds,
			container: extension || null,
			videoCodec: isAudioOnlyContainer ? null : (videoLine?.[1] ?? null),
			resolution: isAudioOnlyContainer
				? null
				: (resolutionMatch?.[1] ?? null),
			audioCodec: audioLine?.[1] ?? null,
			audioBitrate: bitrateMatch?.[1]?.replace(/\s+/g, ' ') ?? null,
			hasCover,
		};
		this.selected = { path: filePath, metadata: descriptor };
		this.pendingDestination = null;
		return descriptor;
	}

	/** Runs FFmpeg's input probe and collects its diagnostic output. */
	private runInspection(
		filePath: string,
	): Promise<{ ok: boolean; text: string; error?: string }> {
		return new Promise((resolve) => {
			const child = spawn(
				this.ffmpegPath,
				['-hide_banner', '-i', filePath],
				{
					stdio: ['ignore', 'pipe', 'pipe'],
				},
			);
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
								error:
									errorText ||
									`FFmpeg exited with code ${code}`,
							},
				);
			});
		});
	}

	/** Opens the native file picker and inspects the selected media. */
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

	/** Opens the native file picker for a secondary audio file. */
	async selectAudioFile(
		window: BrowserWindow,
	): Promise<SelectedAudioFile | null> {
		const result = await dialog.showOpenDialog(window, {
			title: 'Select an audio file',
			properties: ['openFile'],
			filters: [
				{
					name: 'Audio files',
					extensions: [...AUDIO_EXTENSIONS],
				},
			],
		});
		if (result.canceled || result.filePaths.length === 0) return null;
		const audioPath = result.filePaths[0];
		return { path: audioPath, name: path.basename(audioPath) };
	}

	/** Selects and associates an output location with a pending job ID. */
	async chooseOutput(
		window: BrowserWindow,
		jobId: string,
		kind: ExtractionKind,
		format: AudioFormat = 'mp3',
	): Promise<string | null> {
		if (!this.selected)
			throw new Error(
				'Select media before choosing an output destination.',
			);
		if (!isValidJobId(jobId))
			throw new Error('Invalid output selection ID.');
		if (
			kind !== 'audio-extract' &&
			kind !== 'audio-replace' &&
			kind !== 'audio-mute' &&
			kind !== 'cover-jpg' &&
			kind !== 'frames-jpg'
		)
			throw new Error('Unsupported output type.');
		if (this.activeJob)
			throw new Error('Cannot change output during extraction.');

		let destination: string | null = null;
		const baseName = path.basename(
			this.selected.path,
			path.extname(this.selected.path),
		);
		if (kind === 'audio-extract') {
			const info = AUDIO_FORMAT_INFO[format] ?? AUDIO_FORMAT_INFO.mp3;
			const ext = format in AUDIO_FORMAT_INFO ? format : 'mp3';
			const picked = await dialog.showSaveDialog(window, {
				title: `Choose ${ext.toUpperCase()} destination`,
				defaultPath: `${baseName}.${ext}`,
				filters: [{ name: info.label, extensions: [ext] }],
			});
			if (!picked.canceled && picked.filePath) {
				const selectedPath = path.parse(picked.filePath);
				destination = path.join(
					selectedPath.dir,
					`${selectedPath.name}.${ext}`,
				);
			}
		} else if (kind === 'audio-replace' || kind === 'audio-mute') {
			const ext =
				path.extname(this.selected.path).slice(1).toLowerCase() ||
				'mp4';
			const suffix = kind === 'audio-mute' ? 'muted' : 'audio';
			const picked = await dialog.showSaveDialog(window, {
				title:
					kind === 'audio-mute'
						? 'Choose muted video destination'
						: 'Choose output video destination',
				defaultPath: `${baseName}-${suffix}.${ext}`,
				filters: [
					{
						name: `${ext.toUpperCase()} video`,
						extensions: [ext],
					},
				],
			});
			if (!picked.canceled && picked.filePath) {
				const selectedPath = path.parse(picked.filePath);
				destination = path.join(
					selectedPath.dir,
					`${selectedPath.name}.${ext}`,
				);
			}
		} else if (kind === 'cover-jpg') {
			const picked = await dialog.showSaveDialog(window, {
				title: 'Choose cover image destination',
				defaultPath: `${baseName}-cover.jpg`,
				filters: [{ name: 'JPEG image', extensions: ['jpg', 'jpeg'] }],
			});
			if (!picked.canceled && picked.filePath) {
				const selectedPath = path.parse(picked.filePath);
				destination = path.join(
					selectedPath.dir,
					`${selectedPath.name}.jpg`,
				);
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

	/** Validates a request and starts its FFmpeg extraction job. */
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

		const validation = this.validateRequest(request);
		if (validation) return { status: 'error', message: validation };

		const selection = this.pendingDestination;
		if (
			!selection ||
			selection.jobId !== request.jobId ||
			selection.kind !== request.kind
		)
			return {
				status: 'error',
				message:
					'Choose a matching output destination before extraction.',
			};
		this.pendingDestination = null;
		return this.runJob(window, sender, request, selection.path, onProgress);
	}

	/** Validates request-specific settings and source stream prerequisites. */
	private validateRequest(request: StartExtractionRequest): string | null {
		const meta = this.selected!.metadata;
		switch (request.kind) {
			case 'audio-extract':
				if (meta.audioCodec == null)
					return 'The selected media does not contain an audio stream.';
				return validateAudioExtractSettings(request.settings);
			case 'audio-replace':
				if (meta.videoCodec == null)
					return 'Replacing or mixing audio requires a video stream.';
				return validateAudioReplaceSettings(
					request.settings,
					meta.audioCodec != null,
				);
			case 'audio-mute':
				if (meta.videoCodec == null || meta.audioCodec == null)
					return 'Removing audio requires a media file with both video and audio streams.';
				return null;
			case 'cover-jpg':
				if (!meta.hasCover)
					return 'The selected media does not contain cover art.';
				return null;
			case 'frames-jpg':
				return validateFrameSettings(
					request.settings,
					meta.durationSeconds,
				);
		}
	}

	/** Builds FFmpeg CLI arguments for any supported media job kind. */
	private buildJobArgs(
		request: StartExtractionRequest,
		destination: string,
	): string[] {
		switch (request.kind) {
			case 'audio-extract':
				return this.audioExtractArgs(destination, request.settings);
			case 'audio-replace':
				return this.audioReplaceArgs(destination, request.settings);
			case 'audio-mute':
				return [
					'-hide_banner',
					'-y',
					'-i',
					this.selected!.path,
					'-c:v',
					'copy',
					'-an',
					destination,
				];
			case 'cover-jpg':
				return [
					'-hide_banner',
					'-y',
					'-i',
					this.selected!.path,
					'-an',
					'-frames:v',
					'1',
					'-q:v',
					'2',
					destination,
				];
			case 'frames-jpg':
				return this.frameArgs(destination, request.settings);
		}
	}

	/** Runs FFmpeg and resolves with the job's final result. */
	private runJob(
		window: BrowserWindow,
		sender: WebContents,
		request: StartExtractionRequest,
		destination: string,
		onProgress: (percent: number | null) => void,
	): Promise<ExtractionResult> {
		return new Promise((resolve) => {
			const args = this.buildJobArgs(request, destination);
			const isFrameJob = request.kind === 'frames-jpg';

			let stderr = '';
			const process = spawn(this.ffmpegPath, args, {
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			const job: Job = {
				id: request.jobId,
				sender,
				process,
				kind: request.kind,
				outputs: isFrameJob ? [] : [destination],
				outputDirectory: isFrameJob ? destination : undefined,
				aborted: false,
				existingFrameFiles:
					isFrameJob && fs.existsSync(destination)
						? new Set(
								fs
									.readdirSync(destination)
									.filter((name) =>
										/^frame-\d{6}\.jpg$/i.test(name),
									)
									.map((name) =>
										path.join(destination, name),
									),
							)
						: new Set(),
			};
			this.activeJob = job;

			process.stderr.on('data', (data) => {
				stderr += data.toString();
				const time = stderr
					.slice(-4000)
					.match(/time=(\d+):(\d+):([\d.]+)/);
				if (time) {
					const seconds =
						Number(time[1]) * 3600 +
						Number(time[2]) * 60 +
						Number(time[3]);
					const duration = this.selected?.metadata.durationSeconds;
					onProgress(
						duration
							? Math.min(
									100,
									Math.max(0, (seconds / duration) * 100),
								)
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
						message:
							stderr.trim() || `FFmpeg exited with code ${code}.`,
					});
					return;
				}

				if (request.kind !== 'frames-jpg') {
					if (
						!fs.existsSync(destination) ||
						fs.statSync(destination).size === 0
					) {
						resolve({
							status: 'error',
							message:
								'FFmpeg completed without producing the output file.',
						});
						return;
					}
					job.outputs = [destination];
					this.completedJobs.set(request.jobId, {
						kind: request.kind,
						outputs: job.outputs,
						sender,
					});
					resolve({
						status: 'success',
						kind: request.kind,
						outputPath: destination,
					});
				} else {
					const files = fs.existsSync(destination)
						? fs
								.readdirSync(destination)
								.filter((name) => /\.jpe?g$/i.test(name))
								.map((name) => path.join(destination, name))
								.filter(
									(file) => !job.existingFrameFiles.has(file),
								)
								.filter((file) => fs.statSync(file).size > 0)
						: [];
					if (files.length === 0) {
						resolve({
							status: 'error',
							message:
								'FFmpeg completed without producing any JPG frames.',
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

	/** Builds FFmpeg arguments for extracting audio in the requested format. */
	private audioExtractArgs(
		destination: string,
		settings: AudioExtractSettings,
	): string[] {
		const info = AUDIO_FORMAT_INFO[settings.format];
		const args = [
			'-hide_banner',
			'-y',
			'-i',
			this.selected!.path,
			'-vn',
			'-ac',
			'2',
		];
		if (settings.sampleRate != null) {
			args.push('-ar', String(settings.sampleRate));
		}
		if (info.lossy && settings.bitrate) {
			args.push('-b:a', settings.bitrate);
		}
		args.push('-c:a', info.codec, destination);
		return args;
	}

	/** Builds FFmpeg arguments for replacing or mixing a video's audio track. */
	private audioReplaceArgs(
		destination: string,
		settings: AudioReplaceSettings,
	): string[] {
		const args = ['-hide_banner', '-y', '-i', this.selected!.path];
		const offset = settings.offsetSeconds ?? 0;

		if (settings.mode === 'replace') {
			if (offset > 0) {
				args.push('-itsoffset', String(offset));
			}
			args.push(
				'-i',
				settings.audioPath,
				'-map',
				'0:v:0',
				'-map',
				'1:a:0',
				'-c:v',
				'copy',
				'-shortest',
				destination,
			);
			return args;
		}

		const delayMs = Math.round(offset * 1000);
		const filter =
			delayMs > 0
				? `[1:a:0]adelay=${delayMs}|${delayMs}[delayed];[0:a:0][delayed]amix=inputs=2:duration=first:dropout_transition=2[aout]`
				: '[0:a:0][1:a:0]amix=inputs=2:duration=first:dropout_transition=2[aout]';
		args.push(
			'-i',
			settings.audioPath,
			'-filter_complex',
			filter,
			'-map',
			'0:v:0',
			'-map',
			'[aout]',
			'-c:v',
			'copy',
			destination,
		);
		return args;
	}

	/** Builds FFmpeg arguments for the requested frame range and sampling mode. */
	private frameArgs(destination: string, settings: FrameSettings): string[] {
		const args = ['-hide_banner', '-y', '-i', this.selected!.path];
		if (settings.startSeconds != null)
			args.push('-ss', String(settings.startSeconds));
		if (settings.durationSeconds != null)
			args.push('-t', String(settings.durationSeconds));
		const filters: string[] = [];
		if (settings.size)
			filters.push(`scale=${settings.size.replace('x', ':')}`);
		switch (settings.samplingMode) {
			case 'frameInterval':
				filters.push(`select=not(mod(n\\,${settings.samplingValue}))`);
				break;
			case 'timeInterval':
				filters.push(`fps=1/${settings.samplingValue}`);
				break;
			case 'percentage':
				filters.push(
					`fps=1/${((this.selected!.metadata.durationSeconds! * Number(settings.samplingValue!)) / 100).toFixed(6)}`,
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

	/** Aborts the active extraction if it belongs to the requesting renderer. */
	abort(sender: WebContents, jobId: string): void {
		if (!isValidJobId(jobId)) throw new Error('Invalid extraction job ID.');
		if (!this.activeJob || this.activeJob.id !== jobId)
			throw new Error('Unknown or inactive extraction job.');
		if (this.activeJob.sender !== sender)
			throw new Error('Unknown or foreign extraction job.');
		this.activeJob.aborted = true;
		this.activeJob.process.kill('SIGKILL');
	}

	/** Reveals a completed output after verifying that the job belongs to sender. */
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

	/** Removes newly generated output files after an extraction is cancelled. */
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
