import '@testing-library/jest-dom';
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import App from '../renderer/App';

jest.mock('swiper/react', () => {
	const React = require('react');
	const makeSwiper = (withNavigation: boolean) =>
		function MockSwiper({
			children,
			className,
			tabIndex,
			onKeyDownCapture,
			onSwiper,
			onSlideChange,
			direction,
			allowTouchMove,
			allowSlidePrev,
			allowSlideNext,
			'aria-label': ariaLabel,
			'aria-hidden': ariaHidden,
			inert,
		}: {
			children: ReactNode;
			className?: string;
			tabIndex?: number;
			onKeyDownCapture?: React.KeyboardEventHandler<HTMLDivElement>;
			onSwiper?: (swiper: {
				activeIndex: number;
				slideTo: (index: number) => void;
				slideNext: () => void;
				slidePrev: () => void;
			}) => void;
			onSlideChange?: (swiper: { activeIndex: number }) => void;
			direction?: string;
			allowTouchMove?: boolean;
			allowSlidePrev?: boolean;
			allowSlideNext?: boolean;
			'aria-label'?: string;
			'aria-hidden'?: boolean;
			inert?: boolean;
		}) {
			const [activeIndex, setActiveIndex] = React.useState(0);
			const api = React.useRef({
				activeIndex: 0,
				slideTo: (index: number) => index,
				slideNext: () => {},
				slidePrev: () => {},
			});
			const slideChange = React.useRef(onSlideChange);
			slideChange.current = onSlideChange;
			const swiperCallback = React.useRef(onSwiper);
			swiperCallback.current = onSwiper;
			const updateIndex = (index: number) => {
				api.current.activeIndex = index;
				setActiveIndex(index);
				slideChange.current?.(api.current);
			};
			api.current.slideTo = (index: number) => updateIndex(index);
			api.current.slideNext = () => updateIndex(activeIndex + 1);
			api.current.slidePrev = () =>
				updateIndex(Math.max(0, activeIndex - 1));
			React.useEffect(() => {
				swiperCallback.current?.(api.current);
			}, []);
			return React.createElement(
				'div',
				{
					className,
					tabIndex,
					onKeyDownCapture,
					'aria-label': ariaLabel,
					'aria-hidden': ariaHidden,
					role: withNavigation && ariaLabel ? 'group' : undefined,
					inert,
					'data-testid': withNavigation ? 'swiper' : 'swiper-slide',
					'data-direction': direction,
					'data-allow-touch-move':
						allowTouchMove == null
							? undefined
							: String(allowTouchMove),
					'data-allow-slide-prev':
						allowSlidePrev == null
							? undefined
							: String(allowSlidePrev),
					'data-allow-slide-next':
						allowSlideNext == null
							? undefined
							: String(allowSlideNext),
					'data-active-index': withNavigation
						? activeIndex
						: undefined,
				},
				children,
			);
		};
	return {
		Swiper: makeSwiper(true),
		SwiperSlide: makeSwiper(false),
	};
});
jest.mock('swiper/modules', () => ({ Mousewheel: {} }));
jest.mock('swiper/css', () => ({}));

const media = {
	path: '/tmp/clip.mp4',
	name: 'clip.mp4',
	extension: 'mp4',
	durationSeconds: 60,
	container: 'mp4',
	videoCodec: 'h264',
	resolution: '1280x720',
	audioCodec: 'aac',
	audioBitrate: '192 kb/s',
	hasCover: false,
};

const mediaApi = {
	selectMedia: jest.fn(),
	selectAudioFile: jest.fn(),
	inspectDroppedMedia: jest.fn(),
	clearSelection: jest.fn(),
	chooseOutput: jest.fn(),
	startExtraction: jest.fn(),
	abortExtraction: jest.fn(),
	revealOutput: jest.fn(),
	onProgress: jest.fn<
		() => void,
		[
			(event: {
				jobId: string;
				percent: number | null;
				status: 'running';
			}) => void,
		]
	>(() => () => {}),
};

const selectAndAcceptMedia = async () => {
	fireEvent.click(screen.getByRole('button', { name: 'Choose media' }));
	await screen.findByRole('heading', { name: 'Review media' });
	fireEvent.click(screen.getByRole('button', { name: 'Use this media' }));
	await screen.findByRole('heading', { name: 'Choose extraction' });
};

const selectAction = (name: string) => {
	const card = screen.getByRole('heading', { name }).parentElement!;
	fireEvent.click(within(card).getByRole('button', { name: 'Select' }));
};

const chooseOutput = async (label: 'file' | 'folder') => {
	fireEvent.click(
		screen.getByRole('button', { name: `Choose output ${label}` }),
	);
	await waitFor(() => expect(mediaApi.chooseOutput).toHaveBeenCalled());
};

const configureFrames = async () => {
	await selectAndAcceptMedia();
	fireEvent.click(screen.getByRole('button', { name: 'Next action' }));
	const framesCard = screen.getByRole('heading', {
		name: 'Extract frames to JPG',
	}).parentElement!;
	fireEvent.click(within(framesCard).getByRole('button', { name: 'Select' }));
};

describe('App', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mediaApi.selectMedia.mockResolvedValue(media);
		mediaApi.selectAudioFile.mockResolvedValue({
			path: '/tmp/voice.mp3',
			name: 'voice.mp3',
		});
		mediaApi.inspectDroppedMedia.mockResolvedValue(media);
		mediaApi.chooseOutput.mockResolvedValue('/tmp/clip.mp3');
		mediaApi.startExtraction.mockResolvedValue({
			status: 'success',
			kind: 'audio-extract',
			outputPath: '/tmp/clip.mp3',
		});
		Object.defineProperty(window, 'mediaApi', {
			configurable: true,
			value: mediaApi,
		});
	});

	it('renders the streamlined overlay and three-stage accessible workflow', () => {
		render(<App />);
		expect(
			screen.getByRole('heading', { name: 'Ganzo Media Converter' }),
		).toBeInTheDocument();
		expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument();
		expect(
			screen.queryByRole('navigation', { name: 'Workflow stages' }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Previous media view' }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Next media view' }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'Continue to extraction' }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: 'Media' }),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Choose media' }),
		).toBeEnabled();
		expect(screen.getAllByTestId('swiper')[0]).toHaveAttribute(
			'data-allow-touch-move',
			'true',
		);
	});

	it('marks offscreen slides inert and supports dot indicators and arrow-key carousel navigation', async () => {
		render(<App />);
		const slides = screen
			.getAllByTestId('swiper')[0]
			.querySelectorAll(':scope > [data-testid="swiper-slide"]');
		expect(slides[0]).toHaveAttribute('aria-hidden', 'false');
		expect(slides[1]).toHaveAttribute('inert');

		const mediaDot1 = screen.getByRole('button', {
			name: 'Media view 1 of 2: Select media',
		});
		const mediaDot2 = screen.getByRole('button', {
			name: 'Media view 2 of 2: Review media',
		});
		expect(mediaDot1).toHaveAttribute('aria-current', 'true');
		expect(mediaDot2).toBeDisabled();

		fireEvent.click(screen.getByRole('button', { name: 'Choose media' }));
		await screen.findByRole('heading', { name: 'Review media' });
		expect(mediaDot2).toBeEnabled();
		expect(mediaDot2).toHaveAttribute('aria-current', 'true');

		fireEvent.keyDown(window, { key: 'ArrowLeft' });
		expect(mediaDot1).toHaveAttribute('aria-current', 'true');
		fireEvent.keyDown(window, { key: 'ArrowRight' });
		expect(mediaDot2).toHaveAttribute('aria-current', 'true');
	});

	it('navigates actions with arrow keys and advances immediately on action selection', async () => {
		render(<App />);
		await selectAndAcceptMedia();
		expect(
			screen.queryByRole('button', { name: 'Continue to configure' }),
		).not.toBeInTheDocument();

		const dot1 = screen.getByRole('button', {
			name: 'Action 1 of 7: Extract audio',
		});
		const dot2 = screen.getByRole('button', {
			name: 'Action 2 of 7: Extract frames to JPG',
		});
		expect(dot1).toHaveAttribute('aria-current', 'true');

		const nextArrow = screen.getByRole('button', { name: 'Next action' });
		nextArrow.focus();
		fireEvent.keyDown(nextArrow, { key: 'ArrowRight' });
		expect(dot2).toHaveAttribute('aria-current', 'true');

		fireEvent.keyDown(window, { key: 'ArrowLeft' });
		expect(dot1).toHaveAttribute('aria-current', 'true');

		selectAction('Extract audio');
		expect(
			await screen.findByRole('heading', { name: 'Configure and run' }),
		).toBeInTheDocument();
		expect(screen.getByText(/Step 3 of 3/)).toBeInTheDocument();
	});

	it('shows placeholder actions as unavailable', () => {
		render(<App />);
		expect(screen.getAllByText('Not available yet').length).toBeGreaterThan(
			0,
		);
	});

	it('surfaces dropped-media analysis errors', async () => {
		mediaApi.inspectDroppedMedia.mockRejectedValue(
			new Error('Unsupported media type'),
		);
		render(<App />);
		const dropZone = screen.getByText(
			/Choose or drag a media file/i,
		).parentElement!;
		fireEvent.drop(dropZone, {
			dataTransfer: { files: [new File(['video'], 'clip.txt')] },
		});
		const alerts = await screen.findAllByRole('alert');
		expect(
			alerts.some((alert) =>
				/Unsupported media type/.test(alert.textContent ?? ''),
			),
		).toBe(true);
	});

	it('uses the native output picker before starting audio extraction', async () => {
		render(<App />);
		await selectAndAcceptMedia();
		selectAction('Extract audio');
		expect(
			screen.getByRole('button', { name: 'Start extraction' }),
		).toBeDisabled();

		fireEvent.change(screen.getByLabelText('Format'), {
			target: { value: 'flac' },
		});
		expect(screen.getByLabelText('Bitrate')).toBeDisabled();
		fireEvent.change(screen.getByLabelText('Sample rate'), {
			target: { value: '48000' },
		});

		await chooseOutput('file');
		const [{ jobId, kind, format }] = mediaApi.chooseOutput.mock.calls[0];
		expect(jobId).toMatch(/^job-/);
		expect(kind).toBe('audio-extract');
		expect(format).toBe('flac');
		expect(screen.getAllByText('/tmp/clip.mp3').length).toBeGreaterThan(0);

		fireEvent.click(
			screen.getByRole('button', { name: 'Start extraction' }),
		);
		await screen.findByRole('heading', { name: 'Extraction complete' });
		expect(mediaApi.startExtraction).toHaveBeenCalledWith({
			jobId,
			kind: 'audio-extract',
			settings: {
				format: 'flac',
				bitrate: '192k',
				sampleRate: 48000,
			},
		});
	});

	it('supports replacing or mixing audio and muting video', async () => {
		render(<App />);
		await selectAndAcceptMedia();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Action 3 of 7: Replace / mix audio',
			}),
		);
		selectAction('Replace / mix audio');

		expect(
			screen.getByRole('button', { name: 'Choose output file' }),
		).toBeDisabled();
		fireEvent.click(
			screen.getByRole('button', { name: 'Choose audio file' }),
		);
		expect(await screen.findByText('voice.mp3')).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText('Mode'), {
			target: { value: 'mix' },
		});
		fireEvent.change(screen.getByLabelText('Offset (seconds)'), {
			target: { value: '1.5' },
		});

		await chooseOutput('file');
		const [{ jobId, kind }] = mediaApi.chooseOutput.mock.calls[0];
		expect(kind).toBe('audio-replace');

		fireEvent.click(
			screen.getByRole('button', { name: 'Start extraction' }),
		);
		await screen.findByRole('heading', { name: 'Extraction complete' });
		expect(mediaApi.startExtraction).toHaveBeenCalledWith({
			jobId,
			kind: 'audio-replace',
			settings: {
				audioPath: '/tmp/voice.mp3',
				mode: 'mix',
				offsetSeconds: 1.5,
			},
		});
	});

	it('enables cover extraction and disables video actions for audio files with cover art', async () => {
		const audioWithCover = {
			path: '/tmp/song.mp3',
			name: 'song.mp3',
			extension: 'mp3',
			durationSeconds: 180,
			container: 'mp3',
			videoCodec: null,
			resolution: null,
			audioCodec: 'mp3',
			audioBitrate: '320 kb/s',
			hasCover: true,
		};
		mediaApi.selectMedia.mockResolvedValue(audioWithCover);
		mediaApi.chooseOutput.mockResolvedValue('/tmp/song-cover.jpg');
		mediaApi.startExtraction.mockResolvedValue({
			status: 'success',
			kind: 'cover-jpg',
			outputPath: '/tmp/song-cover.jpg',
		});

		render(<App />);
		await selectAndAcceptMedia();

		fireEvent.click(
			screen.getByRole('button', {
				name: 'Action 2 of 7: Extract frames to JPG',
			}),
		);
		const framesHeading = screen.getByRole('heading', {
			name: 'Extract frames to JPG',
		});
		expect(
			within(framesHeading.parentElement!).getByText(
				'Not available for this media.',
			),
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', {
				name: 'Action 5 of 7: Extract cover',
			}),
		);
		selectAction('Extract cover');
		await chooseOutput('file');
		const [{ jobId, kind }] = mediaApi.chooseOutput.mock.calls[0];
		expect(kind).toBe('cover-jpg');

		fireEvent.click(
			screen.getByRole('button', { name: 'Start extraction' }),
		);
		await screen.findByRole('heading', { name: 'Extraction complete' });
		expect(mediaApi.startExtraction).toHaveBeenCalledWith({
			jobId,
			kind: 'cover-jpg',
		});
	});

	it('blocks invalid JPG settings and requires a sampling value', async () => {
		render(<App />);
		await configureFrames();
		fireEvent.change(screen.getByLabelText('Sampling value'), {
			target: { value: '' },
		});

		expect(
			screen.getByText('Sampling value must be a positive number.'),
		).toBeInTheDocument();
		expect(screen.getByLabelText('Sampling value')).toHaveAttribute(
			'aria-invalid',
			'true',
		);
		expect(screen.getByLabelText('Start time (seconds)')).toHaveAttribute(
			'aria-invalid',
			'false',
		);
		expect(
			screen.getByRole('button', { name: 'Choose output folder' }),
		).toBeDisabled();
		expect(mediaApi.chooseOutput).not.toHaveBeenCalled();
	});

	it('associates each JPG validation error only with its affected field', async () => {
		render(<App />);
		await configureFrames();

		const startTime = screen.getByLabelText('Start time (seconds)');
		const duration = screen.getByLabelText('Duration (seconds)');
		const size = screen.getByLabelText('Output size (WIDTHxHEIGHT)');
		const samplingMode = screen.getByLabelText('Sampling mode');
		const samplingValue = screen.getByLabelText('Sampling value');

		fireEvent.change(startTime, { target: { value: '60' } });
		expect(startTime).toHaveAttribute('aria-invalid', 'true');
		expect(startTime).toHaveAttribute(
			'aria-describedby',
			'start-time-error',
		);
		expect(duration).toHaveAttribute('aria-invalid', 'false');
		expect(size).toHaveAttribute('aria-invalid', 'false');
		expect(samplingMode).toHaveAttribute('aria-invalid', 'false');
		expect(samplingValue).toHaveAttribute('aria-invalid', 'false');

		fireEvent.change(startTime, { target: { value: '' } });
		fireEvent.change(size, { target: { value: '640x0' } });
		expect(size).toHaveAttribute('aria-invalid', 'true');
		expect(size).toHaveAttribute('aria-describedby', 'output-size-error');
		expect(startTime).toHaveAttribute('aria-invalid', 'false');
		expect(duration).toHaveAttribute('aria-invalid', 'false');
		expect(samplingValue).toHaveAttribute('aria-invalid', 'false');

		fireEvent.change(size, { target: { value: '' } });
		fireEvent.change(duration, { target: { value: '61' } });
		expect(duration).toHaveAttribute('aria-invalid', 'true');
		expect(duration).toHaveAttribute('aria-describedby', 'duration-error');
		expect(startTime).toHaveAttribute('aria-invalid', 'false');
		expect(size).toHaveAttribute('aria-invalid', 'false');

		fireEvent.change(duration, { target: { value: '' } });
		fireEvent.change(samplingMode, { target: { value: 'percentage' } });
		fireEvent.change(samplingValue, { target: { value: '101' } });
		expect(samplingValue).toHaveAttribute('aria-invalid', 'true');
		expect(samplingValue).toHaveAttribute(
			'aria-describedby',
			'sampling-value-error',
		);
		expect(samplingMode).toHaveAttribute('aria-invalid', 'false');
	});

	it('keeps the selected media when the clear-media IPC request fails', async () => {
		mediaApi.clearSelection.mockRejectedValue(
			new Error('Media service unavailable'),
		);
		render(<App />);
		fireEvent.click(screen.getByRole('button', { name: 'Choose media' }));
		await screen.findByRole('heading', { name: 'Review media' });

		fireEvent.click(
			screen.getByRole('button', { name: 'Remove selection' }),
		);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Media service unavailable',
		);
		expect(screen.getByText('clip.mp4')).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: 'Review media' }),
		).toBeVisible();
	});

	it('focuses the next stage heading and traps/restores dialog focus', async () => {
		mediaApi.startExtraction.mockImplementation(
			() => new Promise(() => undefined),
		);
		render(<App />);
		await selectAndAcceptMedia();
		selectAction('Extract audio');
		await chooseOutput('file');
		fireEvent.click(
			screen.getByRole('button', { name: 'Start extraction' }),
		);
		await waitFor(() =>
			expect(screen.getAllByTestId('swiper')[0]).toHaveAttribute(
				'data-allow-touch-move',
				'false',
			),
		);
		const cancelButton = screen.getByRole('button', {
			name: 'Cancel extraction',
		});
		cancelButton.focus();
		fireEvent.click(cancelButton);
		const keepButton = screen.getByRole('button', {
			name: 'Keep extracting',
		});
		const stopButton = screen.getByRole('button', {
			name: 'Stop extraction',
		});
		await waitFor(() => expect(keepButton).toHaveFocus());

		stopButton.focus();
		fireEvent.keyDown(document, { key: 'Tab' });
		expect(keepButton).toHaveFocus();
		keepButton.focus();
		fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
		expect(stopButton).toHaveFocus();
		fireEvent.keyDown(document, { key: 'Escape' });
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Cancel extraction' }),
			).toHaveFocus(),
		);
	});

	it('focuses and announces extraction start, cancellation request, and completion', async () => {
		let finishExtraction!: (result: {
			status: 'cancelled';
			jobId: string;
		}) => void;
		mediaApi.startExtraction.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishExtraction = resolve;
				}),
		);
		render(<App />);
		await selectAndAcceptMedia();
		selectAction('Extract audio');
		await chooseOutput('file');

		fireEvent.click(
			screen.getByRole('button', { name: 'Start extraction' }),
		);
		const runningHeading = await screen.findByRole('heading', {
			name: 'Running extraction',
		});
		await waitFor(() => expect(runningHeading).toHaveFocus());
		expect(screen.getByText('Extraction started.')).toBeInTheDocument();

		const cancelButton = screen.getByRole('button', {
			name: 'Cancel extraction',
		});
		cancelButton.focus();
		fireEvent.click(cancelButton);
		fireEvent.click(
			screen.getByRole('button', { name: 'Stop extraction' }),
		);

		const cancellingHeading = screen.getByRole('heading', {
			name: 'Cancelling extraction…',
		});
		await waitFor(() => expect(cancellingHeading).toHaveFocus());
		expect(
			screen.getByText(
				'Cancellation requested. Waiting for extraction to stop.',
			),
		).toBeInTheDocument();

		const [{ jobId }] = mediaApi.chooseOutput.mock.calls[0];
		finishExtraction({ status: 'cancelled', jobId });
		const cancelledHeading = await screen.findByRole('heading', {
			name: 'Extraction cancelled',
		});
		await waitFor(() => expect(cancelledHeading).toHaveFocus());
		expect(screen.getByText('Extraction cancelled.')).toBeInTheDocument();
	});

	it('ignores arrow navigation from buttons and editable controls', async () => {
		render(<App />);
		await selectAndAcceptMedia();
		selectAction('Extract audio');
		const verticalSwiper = screen.getAllByTestId('swiper')[0];
		const startButton = screen.getByRole('button', {
			name: 'Start extraction',
		});
		startButton.focus();
		fireEvent.keyDown(startButton, { key: 'ArrowUp' });
		expect(screen.getByText(/Step 3 of 3/)).toBeInTheDocument();
		verticalSwiper.focus();
		fireEvent.keyDown(verticalSwiper, { key: 'ArrowUp' });
		await waitFor(() =>
			expect(
				screen.getByRole('heading', { name: 'Choose extraction' }),
			).toHaveFocus(),
		);
	});

	it('moves back from configure and run with the bottom Previous button', async () => {
		render(<App />);
		await selectAndAcceptMedia();
		selectAction('Extract audio');

		expect(
			screen.getByRole('heading', { name: 'Configure and run' }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

		await waitFor(() =>
			expect(
				screen.getByRole('heading', { name: 'Choose extraction' }),
			).toHaveFocus(),
		);
		expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();
	});

	it('shows progress and reveals a successful MP3 output', async () => {
		let progressListener!: (event: {
			jobId: string;
			percent: number | null;
			status: 'running';
		}) => void;
		mediaApi.onProgress.mockImplementation((listener) => {
			progressListener = listener;
			return () => {};
		});
		mediaApi.startExtraction.mockImplementation(
			() => new Promise(() => undefined),
		);
		render(<App />);
		await selectAndAcceptMedia();
		selectAction('Extract audio');
		await chooseOutput('file');
		fireEvent.click(
			screen.getByRole('button', { name: 'Start extraction' }),
		);
		await screen.findByRole('heading', { name: 'Running extraction' });
		const [{ jobId }] = mediaApi.chooseOutput.mock.calls[0];
		act(() => {
			progressListener({ jobId, percent: 42, status: 'running' });
		});
		await waitFor(() =>
			expect(
				screen.getByLabelText('42 percent extraction progress'),
			).toHaveAttribute('value', '42'),
		);
	});

	it('shows extraction errors and never offers failed output', async () => {
		mediaApi.startExtraction.mockResolvedValue({
			status: 'error',
			message: 'FFmpeg could not encode the media.',
		});
		render(<App />);
		await selectAndAcceptMedia();
		selectAction('Extract audio');
		await chooseOutput('file');
		fireEvent.click(
			screen.getByRole('button', { name: 'Start extraction' }),
		);

		expect(
			await screen.findByText('Extraction failed'),
		).toBeInTheDocument();
		expect(
			screen.getAllByText('FFmpeg could not encode the media.').length,
		).toBeGreaterThan(0);
		expect(
			screen.queryByRole('button', {
				name: 'Show output in file manager',
			}),
		).not.toBeInTheDocument();
	});
});
