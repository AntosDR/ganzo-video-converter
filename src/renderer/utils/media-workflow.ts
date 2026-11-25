import type {
	FrameSettings,
	MediaDescriptor,
} from '../../shared/media-contract';
import type {
	AvailableActionCard,
	FrameSettingsErrors,
} from '../types/workflow';

/** Display labels for the three vertical workflow stages. */
export const STAGE_NAMES = [
	'Media',
	'Choose extraction',
	'Configure and run',
] as const;

/** Implemented extraction actions presented at the start of the action carousel. */
export const AVAILABLE_ACTIONS: AvailableActionCard[] = [
	{
		key: 'audio',
		title: 'Extract audio to MP3',
		text: 'Create a 44.1 kHz stereo 192 kb/s MP3.',
	},
	{
		key: 'frames',
		title: 'Extract frames to JPG',
		text: 'Create numbered JPG frames in a chosen folder.',
	},
];

/** Upcoming actions shown as disabled placeholders in the action carousel. */
export const PLACEHOLDER_ACTIONS: Array<[string, string]> = [
	['Change format', 'Not available yet'],
	['Add watermark', 'Not available yet'],
	['Replace audio', 'Not available yet'],
];

/**
 * Converts inspected media metadata into labeled rows for the review panel.
 *
 * @param media - Inspected media descriptor returned by the main process.
 */
export const metadataRows = (
	media: MediaDescriptor,
): Array<[string, string]> => [
	['File name', media.name],
	[
		'Duration',
		media.durationSeconds == null
			? 'Not available'
			: `${media.durationSeconds.toFixed(1)} seconds`,
	],
	['Container', media.container ?? 'Not available'],
	['Video codec', media.videoCodec ?? 'Not available'],
	['Resolution', media.resolution ?? 'Not available'],
	['Audio codec', media.audioCodec ?? 'Not available'],
	['Audio bitrate', media.audioBitrate ?? 'Not available'],
];

/**
 * Computes field-level validation errors for the current JPG extraction settings.
 *
 * @param settings - Frame extraction options supplied by the user.
 * @param mediaDuration - Known input duration in seconds, or `null` if unavailable.
 */
export const frameSettingsError = (
	settings: FrameSettings,
	mediaDuration: number | null,
): FrameSettingsErrors => {
	const { startSeconds, durationSeconds, size, samplingMode, samplingValue } =
		settings;
	const errors: FrameSettingsErrors = {};

	if (
		startSeconds != null &&
		(!Number.isFinite(startSeconds) || startSeconds < 0)
	) {
		errors.startSeconds = 'Start time must be zero or a positive number.';
	}
	if (
		durationSeconds != null &&
		(!Number.isFinite(durationSeconds) || durationSeconds <= 0)
	) {
		errors.durationSeconds = 'Duration must be a positive number.';
	}
	// FFmpeg cannot seek past or at the exact end of the input stream.
	if (
		mediaDuration != null &&
		startSeconds != null &&
		startSeconds >= mediaDuration
	) {
		errors.startSeconds =
			'Start time must be shorter than the media duration.';
	}
	if (
		mediaDuration != null &&
		durationSeconds != null &&
		(startSeconds ?? 0) + durationSeconds > mediaDuration
	) {
		errors.durationSeconds =
			'Start time plus duration cannot exceed the media duration.';
	}
	if (size && !/^[1-9]\d{1,4}x[1-9]\d{1,4}$/i.test(size)) {
		errors.size =
			'Output size must use positive WIDTHxHEIGHT values, for example 1280x720.';
	}
	if (!samplingMode) {
		errors.samplingMode = 'Choose a JPG sampling mode.';
	}
	if (
		samplingValue == null ||
		!Number.isFinite(samplingValue) ||
		samplingValue <= 0
	) {
		errors.samplingValue = 'Sampling value must be a positive number.';
	}
	if (
		samplingMode === 'percentage' &&
		samplingValue != null &&
		samplingValue > 100
	) {
		errors.samplingValue = 'Percentage sampling must be between 0 and 100.';
	}
	// Percentage mode requires a known duration to map percentages to timestamps.
	if (
		samplingMode === 'percentage' &&
		samplingValue != null &&
		samplingValue > 0 &&
		samplingValue <= 100 &&
		(mediaDuration == null || mediaDuration <= 0)
	) {
		errors.samplingValue =
			'Percentage sampling requires a known media duration.';
	}
	return errors;
};

/**
 * Checks whether vertical stage arrow navigation should yield to an interactive control.
 *
 * @param target - Event target from a `keydown` event.
 */
export const isNonNavigationTarget = (target: EventTarget | null): boolean =>
	target instanceof HTMLElement &&
	Boolean(
		target.closest(
			'button, input, select, textarea, a, [contenteditable="true"], [role="dialog"]',
		),
	);

/**
 * Checks whether horizontal arrow keys are reserved for text editing or modal interaction.
 *
 * @param target - Event target from a `keydown` event.
 */
export const isEditableTarget = (target: EventTarget | null): boolean =>
	target instanceof HTMLElement &&
	Boolean(
		target.closest(
			'input, select, textarea, [contenteditable="true"], [role="dialog"]',
		),
	);

/** Creates a fresh opaque ID used to correlate destination selection and extraction IPC. */
export const createJobId = (): string =>
	`job-${crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`}`;
