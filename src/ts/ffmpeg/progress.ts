/*
 * ffmpeg output decoding functionalities. 
 */

import { durationToSeconds } from "./utils";

/**
 * Parse FFmpeg log for "time=" string in processing stdout.
 * @param text FFmpeg stdout.
 * @returns Retrieved duration in seconds or `null` if no time data found.
 */
export function parseFFmpegLogForDuration(text: string): number|null {
	// Extract parts.
	const duration = /time=(([0-9]+):([0-9]{2}):([0-9]{2}).([0-9]+))/.exec(text); //text.match(/Duration: (.{2}):(.{2}):(.{2}).(.{2})/)

	return duration && duration[1] ? durationToSeconds(duration[1]) : null;
	//return `${durationList[1]}:${durationList[2]}:${durationList[3]}.${durationList[4].padEnd(3, '0')}`;
}
