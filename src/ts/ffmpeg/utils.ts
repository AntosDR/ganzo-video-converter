import { existsSync } from "fs";
import * as path from "path";
import { FfmpegError, renderError, throwError } from "./errors";

/**
 * Path separator.
 */
const PS = path.sep;

/**
 * Check if object is empty
 */
export function isEmptyObj(obj: object): boolean {
	// Scan all properties
	for (var prop in obj) {
		// Check if obj has a property
		{
			if (obj.hasOwnProperty(prop)) {
				// The object is not empty
				return false;
			}
		}
	}
	// The object is empty
	return true;
}


/**
 * Merge obj1 into obj, then returns obj.
 * @param obj The object to fill.
 * @param obj1 The object to retrieve values from.
 * @returns The obj instance.
 */
export function mergeObject<T extends object>(obj: T, obj1: T): T {
	// Check if there are options set
	if (!isEmptyObj(obj1)) {
		// Scan all settings
		for (var key in obj1) {
			// Check if the option is valid
			if (!obj.hasOwnProperty(key)) {
				throwError('invalid_option_name', key);
			}
			// Set new option value
			obj[key] = obj1[key];
		}
	}
	return obj;
}

/**
 * Calculate the duration in seconds from the string retrieved by the ffmpeg info
 */
export function durationToSeconds(duration: string): number {
	var parts = duration.substr(0, 8).split(':');
	return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
};

/**
 * Calculate the greatest common divisor
 */
export function gcd(a: number, b: number): number {
	if (b === 0) return a;
	return gcd(b, a % b);
}

/**
 * Offers functionality similar to mkdir -p
 */
export function mkdir(dirpath: string, mode?: number, callback?: ((err?: FfmpegError) => void), position?: number): boolean {
	// Split all directories
	var parts = path.normalize(dirpath).split(PS);
	// If the first part is empty then remove this part
	if (parts[0] == "") {
		parts = parts.slice(1);
	}

	// Set the initial configuration
	mode = mode || 0x0777;
	position = position || 0;

	// Check se current position is greater than the list of folders
	if (position > parts.length) {
		// If isset the callback then it will be invoked
		if (callback) {
			callback();
		}
		// Exit and return a positive value
		return true;
	}

	// Build the directory path
	var directory = (dirpath.charAt(0) == PS ? PS : '') + parts.slice(0, position + 1).join(PS);

	// Check if directory exists
	if (existsSync(directory)) {
		return mkdir(dirpath, mode, callback, position + 1);
	} else {
		if (existsSync(directory)) {
			// If is-set the callback then it will be invoked
			if (callback) {
				callback(renderError('mkdir', directory));
			}
			// Send the new exception
			throwError('mkdir', directory);
		} else {
			return mkdir(dirpath, mode, callback, position + 1);
		}
	}
}

/**
 * Check if a value is present inside an array.
 * @param value The value to search for.
 * @param array The array to search value in.
 * @returns The position of the array where value was found, boolean false if not found.
 */
export function in_array<T>(value: T, array: T[]): number | false {
	// Scan all element
	for (var i in array) {
		// Check if value exists
		if (array[i] == value) {
			// Return the position of value
			return parseInt(i);
		}
	}
	// The value not exists
	return false;
}

/**
 * Ensure command line parameters containing spaces don't break
 * e.g. (input file)
 */
export function addQuotes(filename: string): string {
	// Add quotes
	return JSON.stringify(filename);
}

/**
 * Duration conversion utility class.
 */
export class Duration {
	/**
	 * Computed amount of seconds.
	 */
	public readonly durationSeconds: number;

	/**
	 * Constructs a duration with a fixed total amount of seconds.
	 * @param seconds The amount of seconds to set.
	 */
	constructor(seconds: number);

	/**
	 * Constructs a duration from given string.
	 * @param duration The duration string with format `"hh:mm:ss"`.
	 */
	constructor(duration: string);

	/**
	 * Constructs the duration object from given de-composed duration values.
	 * @param hours The amount of hours.
	 * @param minutes The amount of minutes.
	 * @param seconds The amount of seconds.
	 */
	constructor(hours: number, minutes: number, seconds: number);

	/**
	 * Constructors implementation.
	 * @param secondsAmountOrDurationOrHours The hours component, or string or total seconds amount.
	 * @param minutes The minutes amount.
	 * @param seconds The seconds.
	 */
	constructor(secondsAmountOrDurationOrHours: number | string, minutes?: number, seconds?: number) {
		if (typeof secondsAmountOrDurationOrHours == "number" && minutes !== undefined && seconds !== undefined) {
			this.durationSeconds = secondsAmountOrDurationOrHours[0] * 3600 + minutes[1] * 60 + seconds[2];
		} else if (typeof secondsAmountOrDurationOrHours == "string") {
			const parts = /([0-9]+):([0-9]{2}):([0-9]{2})/.exec(secondsAmountOrDurationOrHours);
			if (parts && parts.length == 4) {
				this.durationSeconds = parseInt(parts[1]) * 3600 + parseInt(parts[2]) * 60 + parseInt(parts[3]);
			} else {
				throwError("time_not_valid", secondsAmountOrDurationOrHours);
			}
		} else {
			this.durationSeconds = secondsAmountOrDurationOrHours;
		}
	}

}
