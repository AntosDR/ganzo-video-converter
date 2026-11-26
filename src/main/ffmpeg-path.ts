import { createRequire } from 'node:module';
import path from 'node:path';

type RuntimePlatform = 'darwin' | 'linux' | 'win32';

/** Runtime paths and platform details used to locate the FFmpeg binary. */
type FfmpegPathOptions = {
	isPackaged: boolean;
	resourcesPath: string;
	appPath: string;
	platform?: NodeJS.Platform;
	arch?: string;
};

const PLATFORM_DIRECTORY: Record<RuntimePlatform, string> = {
	darwin: 'mac',
	linux: 'linux',
	win32: 'win',
};

/**
 * Resolves the FFmpeg executable for the current app runtime.
 *
 * Packaged apps use the copied resource; development resolves the installed
 * package from the app root so bundling does not change its module location.
 */
export function resolveFfmpegPath({
	isPackaged,
	resourcesPath,
	appPath,
	platform = process.platform,
	arch = process.arch,
}: FfmpegPathOptions): string {
	if (!(platform in PLATFORM_DIRECTORY)) {
		throw new Error(`Unsupported FFmpeg platform: ${platform}`);
	}

	const runtimePlatform = platform as RuntimePlatform;
	const binaryName = runtimePlatform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

	if (isPackaged) {
		return path.join(
			resourcesPath,
			'ffmpeg',
			PLATFORM_DIRECTORY[runtimePlatform],
			arch,
			binaryName,
		);
	}

	// Resolve from the app root rather than using the package's exported path:
	// its __dirname is relocated into dist/main when electron-vite bundles it.
	const requireFromApp = createRequire(path.join(appPath, 'package.json'));
	const packageEntry = requireFromApp.resolve('ffmpeg-static-electron');
	return path.join(
		path.dirname(packageEntry),
		'bin',
		PLATFORM_DIRECTORY[runtimePlatform],
		arch,
		binaryName,
	);
}
