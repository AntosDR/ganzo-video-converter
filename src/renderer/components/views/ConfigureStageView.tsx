import type {
	AudioExtractSettings,
	AudioReplaceSettings,
	FrameSettings,
	MediaDescriptor,
} from '../../../shared/media-contract';
import type {
	Action,
	AudioReplaceSettingsErrors,
	FrameSettingsErrors,
	JobState,
} from '../../types/workflow';
import { AudioExtractSettingsForm } from './AudioExtractSettingsForm';
import { AudioReplaceSettingsForm } from './AudioReplaceSettingsForm';
import { FrameSettingsForm } from './FrameSettingsForm';
import { JobStatusPanel } from './JobStatusPanel';

/** Props for {@link ConfigureStageView}. */
export interface ConfigureStageViewProps {
	/** Inspected media descriptor, or `null` if none is selected yet. */
	media: MediaDescriptor | null;
	/** Selected extraction action, or `null` before Stage 2 is completed. */
	action: Action | null;
	/** Current lifecycle state of the extraction job. */
	jobState: JobState;
	/** Opaque ID correlating destination selection with extraction IPC. */
	jobId: string;
	/** Chosen output file or folder path. */
	destination: string;
	/** Indicates that the native output picker dialog is currently open. */
	choosingOutput: boolean;
	/** Current audio extraction settings. */
	audioExtractSettings: AudioExtractSettings;
	/** Current audio replacement/mixing settings. */
	audioReplaceSettings: AudioReplaceSettings;
	/** Display name of the selected secondary audio file. */
	secondaryAudioName: string;
	/** Per-field validation messages for {@link audioReplaceSettings}. */
	audioReplaceErrors: AudioReplaceSettingsErrors;
	/** Current JPG frame extraction settings. */
	frameSettings: FrameSettings;
	/** Per-field validation messages for {@link frameSettings}. */
	settingsErrors: FrameSettingsErrors;
	/** Whether any setting for the active action has a validation error. */
	hasSettingsError: boolean;
	/** Numeric progress percentage (`0`–`100`) or `null` while indeterminate. */
	progress: number | null;
	/** Generated JPG frame file paths on completion. */
	outputFiles: string[];
	/** Latest extraction or output-picker error message. */
	error: string;
	/** Ref attached to the stage heading for programmatic focus on stage changes. */
	headingRef: (element: HTMLHeadingElement | null) => void;
	/** Ref attached to active job status headings for focus management. */
	jobStateHeadingRef: (element: HTMLHeadingElement | null) => void;
	/** Updates audio extraction settings. */
	onChangeAudioExtractSettings: (next: AudioExtractSettings) => void;
	/** Updates audio replacement/mixing settings. */
	onChangeAudioReplaceSettings: (next: AudioReplaceSettings) => void;
	/** Opens the native picker for a secondary audio file. */
	onSelectAudioFile: () => void | Promise<void>;
	/** Updates JPG frame extraction settings. */
	onChangeFrameSettings: (next: FrameSettings) => void;
	/** Opens the native output file/folder picker. */
	onChooseOutput: () => void | Promise<void>;
	/** Starts the configured extraction job. */
	onStartExtraction: () => void | Promise<void>;
	/** Prompts the user to confirm stopping a running extraction. */
	onRequestAbort: () => void;
	/** Reveals completed output in the system file manager. */
	onRevealOutput: () => void | Promise<void>;
	/** Resets job state while retaining the current media and action. */
	onResetJob: () => void;
	/** Navigates to a target workflow stage (used for Previous / error recovery). */
	onMoveStage: (stage: number) => void;
}

const ACTION_LABELS: Record<Action, string> = {
	audio: 'Audio extraction',
	'audio-replace': 'Replace / mix audio',
	'audio-mute': 'Remove audio (Mute)',
	cover: 'Cover art extraction',
	frames: 'JPG frame extraction',
};

/**
 * Third workflow view displaying the run summary, action-specific settings,
 * output destination picker, execution controls, and live job status.
 */
export function ConfigureStageView({
	media,
	action,
	jobState,
	jobId,
	destination,
	choosingOutput,
	audioExtractSettings,
	audioReplaceSettings,
	secondaryAudioName,
	audioReplaceErrors,
	frameSettings,
	settingsErrors,
	hasSettingsError,
	progress,
	outputFiles,
	error,
	headingRef,
	jobStateHeadingRef,
	onChangeAudioExtractSettings,
	onChangeAudioReplaceSettings,
	onSelectAudioFile,
	onChangeFrameSettings,
	onChooseOutput,
	onStartExtraction,
	onRequestAbort,
	onRevealOutput,
	onResetJob,
	onMoveStage,
}: ConfigureStageViewProps) {
	return (
		<section className="stage">
			<h2 ref={headingRef} tabIndex={-1}>
				Configure and run
			</h2>
			{media && action && (
				<>
					<div className="run-summary">
						<p>
							<strong>Source:</strong> {media.name}
						</p>
						<p>
							<strong>Action:</strong> {ACTION_LABELS[action]}
						</p>
						<p>
							<strong>Output:</strong>{' '}
							{destination || 'Not chosen'}
						</p>
					</div>

					{action === 'audio' && jobState === 'idle' && (
						<AudioExtractSettingsForm
							settings={audioExtractSettings}
							onChange={onChangeAudioExtractSettings}
						/>
					)}

					{action === 'audio-replace' && jobState === 'idle' && (
						<AudioReplaceSettingsForm
							settings={audioReplaceSettings}
							audioFileName={secondaryAudioName}
							hasSourceAudio={media.audioCodec != null}
							errors={audioReplaceErrors}
							onSelectAudioFile={onSelectAudioFile}
							onChange={onChangeAudioReplaceSettings}
						/>
					)}

					{action === 'frames' && jobState === 'idle' && (
						<FrameSettingsForm
							settings={frameSettings}
							errors={settingsErrors}
							onChange={onChangeFrameSettings}
						/>
					)}

					{jobState === 'idle' ? (
						<>
							<div className="button-row">
								<button
									type="button"
									className="primary"
									onClick={() => void onChooseOutput()}
									disabled={
										choosingOutput || hasSettingsError
									}
								>
									{choosingOutput
										? 'Choosing output…'
										: `Choose output ${action === 'frames' ? 'folder' : 'file'}`}
								</button>
								<button
									type="button"
									className="start"
									onClick={() => void onStartExtraction()}
									disabled={
										!media ||
										!action ||
										!destination ||
										!jobId ||
										choosingOutput ||
										hasSettingsError
									}
								>
									Start extraction
								</button>
							</div>
							{destination && (
								<p className="output-path" role="status">
									{destination}
								</p>
							)}
						</>
					) : (
						<JobStatusPanel
							action={action}
							jobState={jobState}
							progress={progress}
							outputFiles={outputFiles}
							destination={destination}
							error={error}
							jobStateHeadingRef={jobStateHeadingRef}
							onRequestAbort={onRequestAbort}
							onRevealOutput={onRevealOutput}
							onResetJob={onResetJob}
							onChooseAnotherMedia={() => onMoveStage(0)}
						/>
					)}
				</>
			)}
			{error && jobState !== 'error' && (
				<div className="alert" role="alert">
					{error}
				</div>
			)}
			{jobState === 'idle' && (
				<div className="stage-nav">
					<button type="button" onClick={() => onMoveStage(1)}>
						Previous
					</button>
				</div>
			)}
		</section>
	);
}
