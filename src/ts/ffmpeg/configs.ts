/**
 * Basic configuration values.
 */
export default {
	encoding: 'utf8',
	timeout: 0,
	maxBuffer: 200 * 1024
} as const;

/**
 * Configurations type.
 */
export type FfmpegConfigs = {
	encoding?: string,
	timeout?: number,
	maxBuffer?: number
};
