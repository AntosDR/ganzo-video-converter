import type {
	FrameSamplingMode,
	FrameSettings,
} from '../../../shared/media-contract';
import type { FrameSettingsErrors } from '../../types/workflow';

/** Props for {@link FrameSettingsForm}. */
export interface FrameSettingsFormProps {
	/** Current JPG frame extraction parameters. */
	settings: FrameSettings;
	/** Per-field validation messages shown inline under affected controls. */
	errors: FrameSettingsErrors;
	/** Updates the frame extraction settings object. */
	onChange: (next: FrameSettings) => void;
}

/**
 * Form fieldset for configuring JPG frame extraction timing, dimensions,
 * sampling mode, and sampling value with accessible field-level validation.
 */
export function FrameSettingsForm({
	settings,
	errors,
	onChange,
}: FrameSettingsFormProps) {
	return (
		<fieldset className="frame-settings">
			<legend>JPG frame settings</legend>
			<div className="settings-field">
				<label htmlFor="start-time">Start time (seconds)</label>
				<input
					id="start-time"
					type="number"
					min="0"
					step="0.1"
					aria-invalid={Boolean(errors.startSeconds)}
					aria-describedby={
						errors.startSeconds ? 'start-time-error' : undefined
					}
					value={settings.startSeconds ?? ''}
					onChange={(event) =>
						onChange({
							...settings,
							startSeconds:
								event.target.value === ''
									? undefined
									: Number(event.target.value),
						})
					}
				/>
				{errors.startSeconds && (
					<span
						id="start-time-error"
						className="field-error"
						role="alert"
					>
						{errors.startSeconds}
					</span>
				)}
			</div>
			<div className="settings-field">
				<label htmlFor="duration">Duration (seconds)</label>
				<input
					id="duration"
					type="number"
					min="0.1"
					step="0.1"
					aria-invalid={Boolean(errors.durationSeconds)}
					aria-describedby={
						errors.durationSeconds ? 'duration-error' : undefined
					}
					value={settings.durationSeconds ?? ''}
					onChange={(event) =>
						onChange({
							...settings,
							durationSeconds:
								event.target.value === ''
									? undefined
									: Number(event.target.value),
						})
					}
				/>
				{errors.durationSeconds && (
					<span
						id="duration-error"
						className="field-error"
						role="alert"
					>
						{errors.durationSeconds}
					</span>
				)}
			</div>
			<div className="settings-field">
				<label htmlFor="output-size">Output size (WIDTHxHEIGHT)</label>
				<input
					id="output-size"
					type="text"
					placeholder="1280x720"
					aria-invalid={Boolean(errors.size)}
					aria-describedby={
						errors.size ? 'output-size-error' : undefined
					}
					value={settings.size ?? ''}
					onChange={(event) =>
						onChange({
							...settings,
							size: event.target.value || undefined,
						})
					}
				/>
				{errors.size && (
					<span
						id="output-size-error"
						className="field-error"
						role="alert"
					>
						{errors.size}
					</span>
				)}
			</div>
			<div className="settings-field">
				<label htmlFor="sampling-mode">Sampling mode</label>
				<select
					id="sampling-mode"
					value={settings.samplingMode ?? ''}
					aria-invalid={Boolean(errors.samplingMode)}
					aria-describedby={
						errors.samplingMode ? 'sampling-mode-error' : undefined
					}
					onChange={(event) =>
						onChange({
							...settings,
							samplingMode: event.target
								.value as FrameSamplingMode,
						})
					}
				>
					<option value="frameInterval">Every N frames</option>
					<option value="timeInterval">Every N seconds</option>
					<option value="percentage">Every N percent</option>
					<option value="frameRate">Frames per second</option>
					<option value="frameCount">Number of frames</option>
				</select>
				{errors.samplingMode && (
					<span
						id="sampling-mode-error"
						className="field-error"
						role="alert"
					>
						{errors.samplingMode}
					</span>
				)}
			</div>
			<div className="settings-field">
				<label htmlFor="sampling-value">Sampling value</label>
				<input
					id="sampling-value"
					type="number"
					min="1"
					value={settings.samplingValue ?? ''}
					aria-invalid={Boolean(errors.samplingValue)}
					aria-describedby={
						errors.samplingValue
							? 'sampling-value-error'
							: undefined
					}
					onChange={(event) =>
						onChange({
							...settings,
							samplingValue:
								event.target.value === ''
									? undefined
									: Number(event.target.value),
						})
					}
				/>
				{errors.samplingValue && (
					<span
						id="sampling-value-error"
						className="field-error"
						role="alert"
					>
						{errors.samplingValue}
					</span>
				)}
			</div>
		</fieldset>
	);
}
