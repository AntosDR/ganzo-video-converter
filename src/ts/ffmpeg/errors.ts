
/**
 * An error descriptor.
 */
export interface FfmpegError {
	/**
	 * Code of the error.
	 */
	code: number,
	/**
	 * Error description message.
	 */
	msg: string
};


// Error list with code and message
const list = {
	'empty_input_filepath': { 'code': 100, 'msg': () => 'The input file path can not be empty' },
	'input_filepath_must_be_string': { 'code': 101, 'msg': () => 'The input file path must be a string' },
	'invalid_option_name': { 'code': 102, 'msg': (arg: string) => `The option "${arg}" is invalid. Check the list of available options` },
	'file_input_not_exist': { 'code': 103, 'msg': () => 'The input file does not exist' },
	'format_not_supported': { 'code': 104, 'msg': (arg: string) => `The format "${arg}" is not supported by the version of ffmpeg` },
	'audio_channel_is_invalid': { 'code': 105, 'msg': (arg: string) => `The audio channel "${arg}" is not valid` },
	'mkdir': { 'code': 106, 'msg': (arg: string) => `Error occurred during creation folder: ${arg}` },
	'extract_frame_invalid_everyN_options': { 'code': 107, 'msg': () => 'You can specify only one option between everyNFrames and everyNSeconds' },
	'invalid_watermark': { 'code': 108, 'msg': (arg: string) => `The watermark "${arg}" does not exists` },
	'invalid_watermark_position': { 'code': 109, 'msg': (arg: string) => `Invalid watermark position "${arg}"` },
	'size_format': { 'code': 110, 'msg': (arg: string) => `The format "${arg}" not supported by the function "setSize"` },
	'resolution_square_not_defined': { 'code': 111, 'msg': () => 'The resolution for pixel aspect ratio is not defined' },
	'command_already_exists': { 'code': 112, 'msg': (arg: string) => `The command "${arg}" already exists` },
	'codec_not_supported': { 'code': 113, 'msg': (arg: string) => `The codec "${arg}" is not supported by the version of ffmpeg` },
	'time_not_valid': { 'code': 114, 'msg': (arg: string) => `The time or duration value "${arg}" is not expressed in a valid format` },
	'output_not_specified': { 'code': 115, 'msg': () => `No output was specified!` }
} as const;

type FfmpegErrorLabel = keyof typeof list;

/**
 * Return the error by the codename.
 * @param codeName The error identifier.
 * @param arg The optional argument to add to the error message.
 * @returns The error instance.
 */
export function renderError(codeName: FfmpegErrorLabel, arg?: string): FfmpegError {
	// Call the function for replace the letter '%s' with the found arguments
	return { 'code': list[codeName].code, 'msg': list[codeName].msg(arg ? arg : '') };
}

/**
 * Exception thrown for an ffmpeg error.
 */
export class FfmpegException extends Error {

	/**
	 * Ffmpeg error description.
	 */
	readonly ffmpegErr: FfmpegError;

	/**
	 * Constructs a new ffmpeg exception.
	 * @param err Error descriptor.
	 */
	constructor(err: FfmpegError) {
		super("Ffmpeg error exception!");
		this.ffmpegErr = err;

		// Set the prototype explicitly.
		Object.setPrototypeOf(this, FfmpegException.prototype);
	}

}

/**
 * Throws an error for given codename.
 * @param codeName The error identifier.
 * @param arg The optional argument to add to the error message.
 */
export function throwError(codeName: FfmpegErrorLabel, arg?: string): never {
	throw new FfmpegException(renderError(codeName, arg));
}
