import type { Action, JobState } from '../../types/workflow';

/** Props for {@link JobStatusPanel}. */
export interface JobStatusPanelProps {
	/** Selected workflow action. */
	action: Action;
	/** Current lifecycle state of the extraction job. */
	jobState: Exclude<JobState, 'idle'>;
	/** Numeric extraction progress percentage (`0`–`100`), or `null` while indeterminate. */
	progress: number | null;
	/** Generated JPG frame file paths when frame extraction completes. */
	outputFiles: string[];
	/** Output file or folder path for the completed job. */
	destination: string;
	/** Failure message displayed when `jobState === 'error'`. */
	error: string;
	/** Ref attached to status headings that receive focus during running/cancelling/cancelled states. */
	jobStateHeadingRef: (element: HTMLHeadingElement | null) => void;
	/** Prompts the user before aborting an in-flight extraction. */
	onRequestAbort: () => void;
	/** Reveals the completed output in the system file manager. */
	onRevealOutput: () => void | Promise<void>;
	/** Resets the job state so the user can configure another extraction. */
	onResetJob: () => void;
	/** Navigates back to Stage 1 to pick a different input media file. */
	onChooseAnotherMedia: () => void;
}

const ACTION_SUCCESS_LABEL: Record<Action, string> = {
	audio: 'Extracted audio',
	'audio-replace': 'Updated video audio',
	'audio-mute': 'Muted video',
	cover: 'Cover art image',
	frames: 'JPG frames',
};

/**
 * Renders progress, cancellation, completion, and failure feedback for an
 * active or finished extraction job.
 */
export function JobStatusPanel({
	action,
	jobState,
	progress,
	outputFiles,
	destination,
	error,
	jobStateHeadingRef,
	onRequestAbort,
	onRevealOutput,
	onResetJob,
	onChooseAnotherMedia,
}: JobStatusPanelProps) {
	if (jobState === 'running') {
		return (
			<div className="job-state" aria-live="off">
				<h3 ref={jobStateHeadingRef} tabIndex={-1}>
					Running extraction
				</h3>
				{progress == null ? (
					<progress aria-label="Extraction progress" />
				) : (
					<>
						<progress
							max="100"
							value={progress}
							aria-label={`${Math.round(progress)} percent extraction progress`}
						/>
						<strong>{progress.toFixed(0)}%</strong>
					</>
				)}
				<button
					type="button"
					className="danger"
					onClick={onRequestAbort}
				>
					Cancel extraction
				</button>
			</div>
		);
	}

	if (jobState === 'cancelling') {
		return (
			<div className="job-state" aria-live="off">
				<h3 ref={jobStateHeadingRef} tabIndex={-1}>
					Cancelling extraction…
				</h3>
				<progress aria-label="Stopping extraction" />
			</div>
		);
	}

	if (jobState === 'cancelled') {
		return (
			<div className="job-state" role="status">
				<h3 ref={jobStateHeadingRef} tabIndex={-1}>
					Extraction cancelled
				</h3>
				<button type="button" onClick={onResetJob}>
					Start another extraction
				</button>
			</div>
		);
	}

	if (jobState === 'success') {
		return (
			<div className="job-state success" role="status">
				<h3>Extraction complete</h3>
				<p>
					{outputFiles.length
						? `${outputFiles.length} JPG frames`
						: ACTION_SUCCESS_LABEL[action]}
				</p>
				<p>
					<strong>Output:</strong> {destination}
				</p>
				<div className="button-row">
					<button
						type="button"
						className="primary"
						onClick={() => void onRevealOutput()}
					>
						Show output in file manager
					</button>
					<button type="button" onClick={onResetJob}>
						Start another extraction
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="alert" role="alert">
			<strong>Extraction failed</strong>
			<p>{error}</p>
			<div className="button-row">
				<button type="button" onClick={onResetJob}>
					Try again
				</button>
				<button type="button" onClick={onChooseAnotherMedia}>
					Choose another media file
				</button>
			</div>
		</div>
	);
}
