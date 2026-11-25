/** Supported extraction actions available in the workflow. */
export type Action = 'audio' | 'frames';

/** Lifecycle states for an extraction job in the renderer. */
export type JobState =
	'idle' | 'running' | 'cancelling' | 'success' | 'cancelled' | 'error';

/** Field-level validation error messages for JPG frame extraction settings. */
export type FrameSettingsErrors = Partial<
	Record<
		| 'startSeconds'
		| 'durationSeconds'
		| 'size'
		| 'samplingMode'
		| 'samplingValue',
		string
	>
>;

/** Descriptor for an individual dot button in {@link CarouselDots}. */
export interface CarouselDotItem {
	/** Accessible label announcing the slide index and title. */
	label: string;
	/** Disables navigation to slides whose prerequisites are not met. */
	disabled?: boolean;
}

/** Definition for an extraction action card that can be selected by the user. */
export interface AvailableActionCard {
	/** Internal action identifier passed to extraction IPC. */
	key: Action;
	/** User-facing card heading. */
	title: string;
	/** Short summary of what the action produces. */
	text: string;
}
