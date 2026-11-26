import type {
	AudioMixMode,
	AudioReplaceSettings,
} from '../../../shared/media-contract';
import type { AudioReplaceSettingsErrors } from '../../types/workflow';

/** Props for {@link AudioReplaceSettingsForm}. */
export interface AudioReplaceSettingsFormProps {
	/** Current audio replacement/mixing parameters. */
	settings: AudioReplaceSettings;
	/** Display name of the chosen secondary audio file, if any. */
	audioFileName: string;
	/** Whether the source video contains an audio track that can be mixed. */
	hasSourceAudio: boolean;
	/** Per-field validation messages shown inline under affected controls. */
	errors: AudioReplaceSettingsErrors;
	/** Opens the native picker for a secondary audio file. */
	onSelectAudioFile: () => void | Promise<void>;
	/** Updates the audio replacement/mixing settings object. */
	onChange: (next: AudioReplaceSettings) => void;
}

/**
 * Form fieldset for configuring audio replacement or mixing with a secondary
 * audio file, mix mode, and optional time offset.
 */
export function AudioReplaceSettingsForm({
	settings,
	audioFileName,
	hasSourceAudio,
	errors,
	onSelectAudioFile,
	onChange,
}: AudioReplaceSettingsFormProps) {
	return (
		<fieldset className="frame-settings">
			<legend>Audio replacement settings</legend>
			<div className="settings-field">
				<span className="field-label">Audio file</span>
				<div className="button-row">
					<button
						id="secondary-audio-btn"
						type="button"
						onClick={() => void onSelectAudioFile()}
						aria-describedby={
							errors.audioPath ? 'audio-file-error' : undefined
						}
					>
						{audioFileName
							? 'Change audio file'
							: 'Choose audio file'}
					</button>
					{audioFileName && (
						<span className="output-path">{audioFileName}</span>
					)}
				</div>
				{errors.audioPath && (
					<span
						id="audio-file-error"
						className="field-error"
						role="alert"
					>
						{errors.audioPath}
					</span>
				)}
			</div>
			<div className="settings-field">
				<label htmlFor="audio-mix-mode">Mode</label>
				<select
					id="audio-mix-mode"
					value={settings.mode}
					aria-invalid={Boolean(errors.mode)}
					aria-describedby={
						errors.mode ? 'audio-mode-error' : undefined
					}
					onChange={(event) =>
						onChange({
							...settings,
							mode: event.target.value as AudioMixMode,
						})
					}
				>
					<option value="replace">Replace original audio</option>
					<option value="mix" disabled={!hasSourceAudio}>
						Mix with original audio
					</option>
				</select>
				{errors.mode && (
					<span
						id="audio-mode-error"
						className="field-error"
						role="alert"
					>
						{errors.mode}
					</span>
				)}
			</div>
			<div className="settings-field">
				<label htmlFor="audio-offset">Offset (seconds)</label>
				<input
					id="audio-offset"
					type="number"
					min="0"
					step="0.1"
					aria-invalid={Boolean(errors.offsetSeconds)}
					aria-describedby={
						errors.offsetSeconds ? 'audio-offset-error' : undefined
					}
					value={settings.offsetSeconds ?? ''}
					onChange={(event) =>
						onChange({
							...settings,
							offsetSeconds:
								event.target.value === ''
									? undefined
									: Number(event.target.value),
						})
					}
				/>
				{errors.offsetSeconds && (
					<span
						id="audio-offset-error"
						className="field-error"
						role="alert"
					>
						{errors.offsetSeconds}
					</span>
				)}
			</div>
		</fieldset>
	);
}
