/** @jest-environment node */
import { dialog, shell } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';
import {
  isValidJobId,
  MediaService,
  validateFrameSettings,
} from '../main/media-service';

jest.mock('electron', () => ({
  dialog: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn(),
  },
  shell: { openPath: jest.fn(), showItemInFolder: jest.fn() },
}));

describe('MediaService validation', () => {
  it('accepts only opaque well-formed extraction job IDs', () => {
    expect(isValidJobId('job-a1b2C3')).toBe(true);
    expect(isValidJobId('a1b2C3')).toBe(false);
    expect(isValidJobId('')).toBe(false);
  });

  it('validates JPG settings and rejects conflicting invalid values', () => {
    expect(
      validateFrameSettings({
        samplingMode: 'frameCount',
        samplingValue: 10,
        startSeconds: 0,
        durationSeconds: 5,
        size: '1280x720',
      }),
    ).toBeNull();

    expect(
      validateFrameSettings({
        samplingMode: 'percentage',
        samplingValue: 101,
      }),
    ).toMatch(/Percentage sampling/);

    expect(
      validateFrameSettings(
        { samplingMode: 'percentage', samplingValue: 25 },
        null,
      ),
    ).toMatch(/known media duration/);

    expect(
      validateFrameSettings({
        samplingMode: 'timeInterval',
        samplingValue: -1,
      }),
    ).toMatch(/positive number/);

    expect(validateFrameSettings(undefined)).toMatch(/settings are required/);
  });

  it('uses the native MP3 picker and binds its destination to a job ID', async () => {
    const service = new MediaService('/fake/ffmpeg');
    Object.assign(service, {
      selected: {
        path: '/media/clip.mp4',
        metadata: { path: '/media/clip.mp4' },
      },
    });
    (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
      canceled: false,
      filePath: '/output.v1/clip.wav',
    });

    const destination = await service.chooseOutput(
      {} as BrowserWindow,
      'job-output1',
      'audio-mp3',
    );

    expect(destination).toBe('/output.v1/clip.mp3');
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        title: 'Choose MP3 destination',
        filters: [{ name: 'MP3 audio', extensions: ['mp3'] }],
      }),
    );
    const result = await service.start(
      {} as BrowserWindow,
      {} as WebContents,
      { jobId: 'job-other1', kind: 'audio-mp3' },
      jest.fn(),
    );
    expect(result).toEqual({
      status: 'error',
      message: 'Choose a matching output destination before extraction.',
    });
  });

  it('requires matching JPEG destinations and rejects JPG settings before start', async () => {
    const service = new MediaService('/fake/ffmpeg');
    Object.assign(service, {
      selected: {
        path: '/media/clip.mp4',
        metadata: { path: '/media/clip.mp4', durationSeconds: 10 },
      },
    });
    (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
      canceled: false,
      filePaths: ['/output/frames'],
    });

    const destination = await service.chooseOutput(
      {} as BrowserWindow,
      'job-frames1',
      'frames-jpg',
    );
    expect(destination).toBe('/output/frames');

    const invalid = await service.start(
      {} as BrowserWindow,
      {} as WebContents,
      {
        jobId: 'job-frames1',
        kind: 'frames-jpg',
        settings: { samplingMode: 'percentage', samplingValue: 101 },
      },
      jest.fn(),
    );
    expect(invalid.status).toBe('error');
    expect(invalid).toMatchObject({
      message: 'Percentage sampling must be between 0 and 100.',
    });
  });

  it('aborts only the owning active job and rejects foreign reveals', () => {
    const sender = {} as WebContents;
    const process = { kill: jest.fn() };
    const service = new MediaService('/fake/ffmpeg');
    Object.assign(service, {
      activeJob: {
        id: 'job-abort1',
        sender,
        process,
        kind: 'audio-mp3',
        outputs: [],
        aborted: false,
        existingFrameFiles: new Set(),
      },
    });

    service.abort(sender, 'job-abort1');
    expect(process.kill).toHaveBeenCalledWith('SIGKILL');
    expect(Object.assign(service, {}).activeJob?.aborted).toBe(true);

    expect(() => service.abort({} as WebContents, 'job-abort1')).toThrow(
      'Unknown or foreign extraction job.',
    );
  });

  it('reveals MP3 files and JPG folders only for the completing sender', () => {
    const sender = {} as WebContents;
    const service = new MediaService('/fake/ffmpeg');
    Object.assign(service, {
      completedJobs: new Map([
        [
          'job-showmp1',
          {
            kind: 'audio-mp3',
            outputs: ['/tmp/clip.mp3'],
            sender,
          },
        ],
        [
          'job-showjp1',
          {
            kind: 'frames-jpg',
            outputs: ['/tmp/frames/frame-000001.jpg'],
            directory: '/tmp/frames',
            sender,
          },
        ],
      ]),
    });

    jest.spyOn(require('node:fs'), 'existsSync').mockReturnValue(true);
    service.reveal(sender, 'job-showmp1');
    expect(shell.showItemInFolder).toHaveBeenCalledWith('/tmp/clip.mp3');
    service.reveal(sender, 'job-showjp1');
    expect(shell.openPath).toHaveBeenCalledWith('/tmp/frames');

    expect(() => service.reveal({} as WebContents, 'job-showmp1')).toThrow(
      'Unknown or foreign extraction job.',
    );
  });
});
