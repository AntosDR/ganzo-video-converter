/*
 * Binary ffmpeg processing management module.
 */

import { ChildProcessWithoutNullStreams, ExecException, spawn } from "child_process";
import { existsSync, lstatSync, unlinkSync } from "fs";
import configs, { FfmpegConfigs } from "./configs";
import { throwError } from "./errors";
import { parseFFmpegLogForDuration } from "./progress";
import { in_array, mergeObject } from "./utils";
import { MediaFile } from "./video";


/**
 * Running ffmpeg process instance, which optionally acts on a specified output file.
 */
export class RunningFfmpeg {

	private completed: boolean;

	/**
	 * Constructs a new instance of the ffmpeg process.
	 * @param process The running process identifier.
	 * @param outputFile The processing output file: could be null.
	 */
	constructor(private readonly process: ChildProcessWithoutNullStreams, private readonly outputFile: string | null) {
		this.completed = false;
		this.process.on("exit", () => this.completed = true);
	}

	/**
	 * Aborts the execution.
	 */
	abort(): void {
		if (!this.completed) {
			this.completed = true;
			if (this.outputFile && lstatSync(this.outputFile).isFile()) {
				const toDel = this.outputFile;
				this.process.on("exit", () => unlinkSync(toDel));
			}
			this.process.kill();
		}
	}

	/**
	 * Registers a callback invoked when processing is complete.
	 * @param callback The on-complete callback to register.
	 */
	registerOnCompleteCallback(callback: (code: number | null, signal: NodeJS.Signals | null) => void): void {
		this.process.on("exit", callback);
	}

	/**
	 * Registers given on-progress callback.
	 * @param media The enconding input file.
	 * @param callback The on-progress callback to register.
	 */
	registerOnProgressCallback(media: MediaFile, callback: (percent: number) => void): void {
		let tot = media.metadata.duration.seconds;
		const listener = (data: any) => {
			let decodedValue = parseFFmpegLogForDuration(data.toString());
			if (decodedValue) {
				let percent = (decodedValue / tot) * 100;
				callback(percent);
			}
		};
		this.process.stdout.on("data", listener);
		this.process.stderr.on("data", listener);
	}

}

/**
 * Exec the list of commands and call the callback function at the end of the process.
 * @param commands The command line arguments.
 * @param settings The settings of the invocation
 * @param outputFile The optionally configured output file.
 * @param callback The callback to invoke on completion or `null` to spawn process
 *  and let next actions to attach callbacks on stdout and exit events.
 * @returns The ffmpeg running instance.
 */
export function ffmpegRun(commands: string[], settings: FfmpegConfigs, outputFile: string | null,
	callback: ((error: ExecException | null, stdout: string, stderr: string) => void) | null): RunningFfmpeg {
	// Exec the command
	/*if (callback) {
		// Create final command line
		let finalCommand = commands.join(" ");
		console.log("ffmpeg exec started (cmd: " + finalCommand + ")");

		// Run process with exec.
		let process = exec(finalCommand, settings, function (error, stdout, stderr) {
			console.log("ffmpeg exec complete (cmd: " + finalCommand + ", has-error: " + (!!error) + ", has-out: " + (!!stdout) + ")");
			// Call the callback function
			callback(error, stdout, stderr);
		});
		return new RunningFfmpeg(process, outputFile);

	} else {*/
	// Run process with spawn.
	let process = spawn(commands[0], commands.slice(1), settings);
	if (callback) {
		let stdOutBuffer: string[] = [];
		let stdErrBuffer: string[] = [];
		process.stdout.on("data", chunk => stdOutBuffer.push(chunk.toString()));
		process.stderr.on("data", chunk => stdErrBuffer.push(chunk.toString()));
		process.on("exit", (code: number | null, signals: NodeJS.Signals | null) => {
			let err: ExecException | null = null;
			if (code || signals) {
				err = {
					name: "ExecException",
					message: "Child process abnormal exit!",
					code: code === null ? undefined : code,
					signal: signals === null ? undefined : signals
				};
			}
			callback(err, stdOutBuffer.join(""), stdErrBuffer.join(""));
		});
	}
	return new RunningFfmpeg(process, outputFile);
	//}
}

export type FfmpegRunCompleteCallback = (error: ExecException | null, result: string | null) => void;

/**
 * Complete command line builder.
 */
export class FfmpegRunBuilder {

	private commands: string[] = [];
	private inputs: string[] = [];
	private filtersComplex: string[] = [];
	private output: string | null = null;
	private runSettings: FfmpegConfigs;

	/**
	 * Constructs a new builder.
	 * @param ffmpegBin Path to ffmpeg binary.
	 * @param runSettings The optional run settings to configure.
	 */
	constructor(private readonly ffmpegBin: string, runSettings?: FfmpegConfigs) {
		this.runSettings = {
			encoding: configs.encoding,
			maxBuffer: configs.maxBuffer,
			timeout: configs.timeout
		};
		if (runSettings) {
			this.runSettings = mergeObject(this.runSettings, runSettings);
		}
	}

	/**
	 * Add a command to be bundled into the ffmpeg command call.
	 * @param command The command to add.
	 * @param argument The optional argument to the command.
	 */
	public addCommand(command: string, argument?: string | number): void {
		// Check if exists the current command
		if (in_array(command, this.commands) === false) {
			// Add the new command
			this.commands.push(command);
			// Add the argument to new command
			if (argument != undefined) {
				this.commands.push(argument.toString());
			}
		} else {
			throwError('command_already_exists', command);
		}
	}

	/**
	 * Add an input stream.
	 * @param argument The input argument to add.
	 */
	public addInput(argument: string): void {
		this.inputs.push(argument);
	}

	/**
	 * Add a filter complex.
	 * @param argument The filter argument to set.
	 */
	public addFilterComplex(argument: string): void {
		this.filtersComplex.push(argument);
	}

	/**
	 * Set the output path.
	 * @param path The output path to set.
	 */
	public setOutput(path: string): void {
		this.output = path;
	}

	/**
	 * Executes the processing with configured options.
	 * @param callback The callback to invoke on completion.
	 * @param expectedOutput The expected output path (file or folder).
	 * @returns The started ffmpeg instance.
	 */
	public execute(callback: FfmpegRunCompleteCallback, expectedOutput: string): RunningFfmpeg {
		var i;
		// Checking if folder is defined
		if (!this.output) {
			throwError("output_not_specified");
		}

		// Create a copy of the commands list
		var finalCommands = [this.ffmpegBin];
		for (let i of this.inputs) {
			finalCommands.push("-i", i);
		}
		finalCommands.push(...this.commands);
		if (this.filtersComplex.length > 0) {
			finalCommands.push('-filter_complex');
			finalCommands.push('"' + this.filtersComplex.join(', ') + '"');
		}
		finalCommands.push("-y", this.output);
		/*, ' -i ']
			.concat(this.inputs.map(addQuotes).join(' -i '))
			.concat(this.commands.join(' '))
			.concat(this.filtersComplex.length > 0 ? ['-filter_complex "']
				.concat(this.filtersComplex.join(', ')).join('') + '"' : [])
			.concat([' -y ', addQuotes(this.output)]);*/

		// Execute the commands from the list
		let instance = ffmpegRun(finalCommands, this.runSettings, expectedOutput, null);
		instance.registerOnCompleteCallback((code, signals) => {
			// Building the result
			let result = null;
			let error = null;
			if (code == 0 && signals === null) {
				// Check if show only destination filename or the complete file list
				if (expectedOutput && !existsSync(expectedOutput)) {
					// If an output is expected but no file exists.
					error = new Error("No output file was produced!");
				} else {
					// If no output file is excepted, or the expected one exists.
					result = expectedOutput;
				}
				/*if (!folder) {
				} else {
					// Clean possible "/" at the end of the string
					if (folder.charAt(folder.length - 1) == PS) {
						folder = folder.substr(0, folder.length - 1);
					}
					// Read file list inside the folder
					result = readdirSync(folder);
					// Scan all file and prepend the folder path
					for (var i in result) {
						result[i] = [folder, result[i]].join(PS);
					}

					if (!result || result.length == 0) {
						// If result folder contains no file.
						error = new Error("No output file was produced!");
					}
				}*/
			} else {
				error = new Error("Error exit for process: code=" + code + ", signals=" + signals);
			}
			// Call the callback to return the info
			callback(error, result);
		});
		return instance;
	}
}
