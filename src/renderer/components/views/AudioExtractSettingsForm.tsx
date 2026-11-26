import type {
	AudioBitrate,
	AudioExtractSettings,
	AudioFormat,
	AudioSampleRate,
} from '../../../shared/media-contract';

/** Props for {@link AudioExtractSettingsForm}. */
export interface AudioExtractSettingsFormProps {
	/** Current audio extraction parameters. */
	settings: AudioExtractSettings;
	/** Updates the audio extraction settings object. */
	onChange: (next: AudioExtractSettings) => void;
}

const LOSSLESS_FORMATS = new Set<AudioFormat>(['wav', 'flac']);

/**
 * Form fieldset for configuring audio extraction format, bitrate, and sample rate.
 */
export function AudioExtractSettingsForm({
	settings,
	onChange,
}: AudioExtractSettingsFormProps) {
	const isLossless = LOSSLESS_FORMATS.has(settings.format);

	return (
		<fieldset className="frame-settings">
			<legend>Audio extraction settings</legend>
			<div className="settings-field">
				<label htmlFor="audio-format">Format</label>
				<select
					id="audio-format"
					value={settings.format}
					onChange={(event) =>
						onChange({
							...settings,
							format: event.target.value as AudioFormat,
						})
					}
				>
					<option value="mp3">MP3</option>
					<option value="aac">AAC</option>
					<option value="wav">WAV (Lossless)</option>
					<option value="flac">FLAC (Lossless)</option>
					<option value="ogg">OGG (Vorbis)</option>
				</select>
			</div>
			<div className="settings-field">
				<label htmlFor="audio-bitrate">Bitrate</label>
				<select
					id="audio-bitrate"
					value={settings.bitrate ?? '192k'}
					disabled={isLossless}
					onChange={(event) =>
						onChange({
							...settings,
							bitrate: event.target.value as AudioBitrate,
						})
					}
				>
					<option value="128k">128 kb/s</option>
					<option value="192k">192 kb/s</option>
					<option value="256k">256 kb/s</option>
					<option value="320k">320 kb/s</option>
				</select>
			</div>
			<div className="settings-field">
				<label htmlFor="audio-sample-rate">Sample rate</label>
				<select
					id="audio-sample-rate"
					value={String(settings.sampleRate ?? 44100)}
					onChange={(event) =>
						onChange({
							...settings,
							sampleRate: Number(
								event.target.value,
							) as AudioSampleRate,
						})
					}
				>
					<option value="44100">44100 Hz</option>
					<option value="48000">48000 Hz</option>
				</select>
			</div>
		</fieldset>
	);
}
