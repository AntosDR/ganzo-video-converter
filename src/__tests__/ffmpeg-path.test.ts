import path from 'node:path';
import { resolveFfmpegPath } from '../main/ffmpeg-path';

describe('resolveFfmpegPath', () => {
  it('resolves unpackaged binaries from the installed package, not the bundle directory', () => {
    const result = resolveFfmpegPath({
      isPackaged: false,
      appPath: path.resolve('release/app'),
      resourcesPath: '/unused/resources',
      platform: 'linux',
      arch: 'x64',
    });

    expect(result).toBe(
      path.resolve('node_modules/ffmpeg-static-electron/bin/linux/x64/ffmpeg'),
    );
  });

  it.each([
    ['linux', 'x64', 'ffmpeg/linux/x64/ffmpeg'],
    ['darwin', 'arm64', 'ffmpeg/mac/arm64/ffmpeg'],
    ['win32', 'ia32', 'ffmpeg/win/ia32/ffmpeg.exe'],
  ] as const)(
    'resolves a packaged %s/%s binary under the app resources directory',
    (platform, arch, relativePath) => {
      expect(
        resolveFfmpegPath({
          isPackaged: true,
          appPath: '/unused/app',
          resourcesPath: '/opt/ganzo/resources',
          platform,
          arch,
        }),
      ).toBe(path.join('/opt/ganzo/resources', relativePath));
    },
  );

  it('rejects platforms without a bundled FFmpeg binary layout', () => {
    expect(() =>
      resolveFfmpegPath({
        isPackaged: true,
        appPath: '/unused/app',
        resourcesPath: '/opt/ganzo/resources',
        platform: 'aix',
      }),
    ).toThrow('Unsupported FFmpeg platform: aix');
  });
});
