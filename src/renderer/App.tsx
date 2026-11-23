import {
	useEffect,
	useRef,
	useState,
	type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
import type {
	FrameSamplingMode,
	FrameSettings,
	MediaDescriptor,
} from '../shared/media-contract';
import './App.css';

type Action = 'audio' | 'frames';
type JobState =
	'idle' | 'running' | 'cancelling' | 'success' | 'cancelled' | 'error';

/** Converts media metadata into labeled rows for the review panel. */
const metadataRows = (media: MediaDescriptor) => [
	['File name', media.name],
	[
		'Duration',
		media.durationSeconds == null
			? 'Not available'
			: `${media.durationSeconds.toFixed(1)} seconds`,
	],
	['Container', media.container ?? 'Not available'],
	['Video codec', media.videoCodec ?? 'Not available'],
	['Resolution', media.resolution ?? 'Not available'],
	['Audio codec', media.audioCodec ?? 'Not available'],
	['Audio bitrate', media.audioBitrate ?? 'Not available'],
];

/**
 * Returns field-level errors for the current JPG extraction settings.
 *
 * @param settings - Frame extraction options supplied by the user.
 * @param mediaDuration - Known input duration, or `null` if it is unavailable.
 */
const frameSettingsError = (
	settings: FrameSettings,
	mediaDuration: number | null,
): Partial<Record<keyof FrameSettings, string>> => {
	const { startSeconds, durationSeconds, size, samplingMode, samplingValue } =
		settings;
	const errors: Partial<Record<keyof FrameSettings, string>> = {};
	if (
		startSeconds != null &&
		(!Number.isFinite(startSeconds) || startSeconds < 0)
	) {
		errors.startSeconds = 'Start time must be zero or a positive number.';
	}
	if (
		durationSeconds != null &&
		(!Number.isFinite(durationSeconds) || durationSeconds <= 0)
	) {
		errors.durationSeconds = 'Duration must be a positive number.';
	}
	if (
		mediaDuration != null &&
		startSeconds != null &&
		startSeconds >= mediaDuration
	) {
		errors.startSeconds =
			'Start time must be shorter than the media duration.';
	}
	if (
		mediaDuration != null &&
		durationSeconds != null &&
		(startSeconds ?? 0) + durationSeconds > mediaDuration
	) {
		errors.durationSeconds =
			'Start time plus duration cannot exceed the media duration.';
	}
	if (size && !/^[1-9]\d{1,4}x[1-9]\d{1,4}$/i.test(size))
		errors.size =
			'Output size must use positive WIDTHxHEIGHT values, for example 1280x720.';
	if (!samplingMode) errors.samplingMode = 'Choose a JPG sampling mode.';
	if (
		samplingValue == null ||
		!Number.isFinite(samplingValue) ||
		samplingValue <= 0
	) {
		errors.samplingValue = 'Sampling value must be a positive number.';
	}
	if (
		samplingMode === 'percentage' &&
		samplingValue != null &&
		samplingValue > 100
	)
		errors.samplingValue = 'Percentage sampling must be between 0 and 100.';
	if (
		samplingMode === 'percentage' &&
		samplingValue != null &&
		samplingValue > 0 &&
		samplingValue <= 100 &&
		(mediaDuration == null || mediaDuration <= 0)
	)
		errors.samplingValue =
			'Percentage sampling requires a known media duration.';
	return errors;
};

/** Checks whether keyboard navigation originated in an interactive element. */
const isNonNavigationTarget = (target: EventTarget | null): boolean =>
	target instanceof HTMLElement &&
	Boolean(
		target.closest(
			'button, input, select, textarea, a, [contenteditable="true"], [role="dialog"]',
		),
	);

/** Creates a fresh opaque ID used to associate destination and extraction IPC. */
const createJobId = () =>
	`job-${crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`}`;

/**
 * Renders the guided workflow for selecting media and extracting audio or frames.
 *
 * The component coordinates renderer state and delegates filesystem and FFmpeg
 * operations to the isolated main-process API.
 */
export default function App() {
	const verticalRef = useRef<SwiperInstance | null>(null);
	const mediaRef = useRef<SwiperInstance | null>(null);
	const actionRef = useRef<SwiperInstance | null>(null);
	const stageHeadingRefs = useRef<Array<HTMLHeadingElement | null>>([]);
	const jobStateHeadingRef = useRef<HTMLHeadingElement | null>(null);
	const previousStageRef = useRef(0);
	const confirmDialogRef = useRef<HTMLDivElement | null>(null);
	const restoreFocusRef = useRef<HTMLElement | null>(null);
	const progressAnnouncementRef = useRef({ percent: 0, time: 0 });
	const [stage, setStage] = useState(0);
	const [mediaSlide, setMediaSlide] = useState(0);
	const [actionSlide, setActionSlide] = useState(0);
	const [media, setMedia] = useState<MediaDescriptor | null>(null);
	const [analyzing, setAnalyzing] = useState(false);
	const [dragActive, setDragActive] = useState(false);
	const [error, setError] = useState('');
	const [announcement, setAnnouncement] = useState('');
	const [action, setAction] = useState<Action | null>(null);
	const [destination, setDestination] = useState('');
	const [jobState, setJobState] = useState<JobState>('idle');
	const [jobId, setJobId] = useState('');
	const [choosingOutput, setChoosingOutput] = useState(false);
	const [progress, setProgress] = useState<number | null>(null);
	const [outputFiles, setOutputFiles] = useState<string[]>([]);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const keepButtonRef = useRef<HTMLButtonElement | null>(null);
	const [frameSettings, setFrameSettings] = useState<FrameSettings>({
		samplingMode: 'frameCount',
		samplingValue: 10,
	});
	const settingsErrors = frameSettingsError(
		frameSettings,
		media?.durationSeconds ?? null,
	);
	const settingsError = Object.values(settingsErrors).some(Boolean);
	const jobBusy = jobState === 'running' || jobState === 'cancelling';
	const canSwipeForward =
		!jobBusy &&
		((stage === 0 && Boolean(media)) || (stage === 1 && Boolean(action)));

	useEffect(() => {
		if (previousStageRef.current === stage) return;
		previousStageRef.current = stage;
		window.setTimeout(
			() =>
				stageHeadingRefs.current[stage]?.focus({
					preventScroll: true,
				}),
			0,
		);
	}, [stage]);

	useEffect(() => {
		if (verticalRef.current?.activeIndex === stage) return;
		verticalRef.current?.slideTo(stage);
	}, [stage]);

	useEffect(() => {
		if (
			jobState !== 'running' &&
			jobState !== 'cancelling' &&
			jobState !== 'cancelled'
		)
			return;
		window.setTimeout(
			() => jobStateHeadingRef.current?.focus({ preventScroll: true }),
			0,
		);
	}, [jobState]);

	useEffect(() => {
		const unsubscribe = window.mediaApi?.onProgress((event) => {
			if (event.jobId !== jobId) return;
			setProgress(event.percent);
			if (event.percent != null) {
				const now = Date.now();
				const percent = Math.round(event.percent);
				const previous = progressAnnouncementRef.current;
				if (
					percent === 100 ||
					percent - previous.percent >= 10 ||
					now - previous.time >= 15000
				) {
					setAnnouncement(`Extraction ${percent}% complete.`);
					progressAnnouncementRef.current = { percent, time: now };
				}
			}
		});
		return () => unsubscribe?.();
	}, [jobId]);

	useEffect(() => {
		if (!confirmOpen) return undefined;
		const dialog = confirmDialogRef.current;
		const focusableSelector =
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
		const closeAndRestore = () => setConfirmOpen(false);
		const keepFocusInDialog = (event: FocusEvent) => {
			if (dialog && !dialog.contains(event.target as Node))
				keepButtonRef.current?.focus();
		};
		const manageDialogKeys = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeAndRestore();
				return;
			}
			if (event.key !== 'Tab' || !dialog) return;
			const focusable = Array.from(
				dialog.querySelectorAll<HTMLElement>(focusableSelector),
			);
			if (focusable.length === 0) {
				event.preventDefault();
				dialog.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		window.setTimeout(() => keepButtonRef.current?.focus(), 0);
		document.addEventListener('keydown', manageDialogKeys);
		document.addEventListener('focusin', keepFocusInDialog);
		return () => {
			document.removeEventListener('keydown', manageDialogKeys);
			document.removeEventListener('focusin', keepFocusInDialog);
			const restoreTarget = restoreFocusRef.current;
			restoreFocusRef.current = null;
			if (restoreTarget?.isConnected)
				window.setTimeout(
					() => restoreTarget.focus({ preventScroll: true }),
					0,
				);
		};
	}, [confirmOpen]);

	/** Checks whether the workflow can navigate to the requested stage. */
	const canMoveStage = (next: number) => {
		if (next < 0 || next > 2 || jobBusy) return false;
		if (next > stage + 1) return false;
		if (next > stage && stage === 0 && !media) return false;
		if (next > stage && stage === 1 && !action) return false;
		if (next > 0 && !media) return false;
		if (next > 1 && !action) return false;
		return true;
	};

	/** Navigates to a stage only when its required earlier choices are complete. */
	const moveStage = (next: number) => {
		if (!canMoveStage(next)) return;
		setStage(next);
		verticalRef.current?.slideTo(next);
	};

	/** Keeps swipe navigation synchronized with the gated workflow state. */
	const handleStageSlideChange = (swiper: SwiperInstance) => {
		const next = swiper.activeIndex;
		if (!canMoveStage(next)) {
			swiper.slideTo(stage, 0);
			return;
		}
		if (next !== stage) setStage(next);
	};

	/** Maps vertical arrow keys to workflow navigation outside form controls. */
	const handleStageKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
		if (isNonNavigationTarget(event.target)) return;
		if (
			event.target instanceof HTMLElement &&
			event.target.closest('.carousel')
		)
			return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			moveStage(stage + (event.key === 'ArrowDown' ? 1 : -1));
		}
	};

	/** Maps horizontal arrow keys to the active media or action carousel. */
	const handleCarouselKeyDown = (
		event: ReactKeyboardEvent<HTMLElement>,
		carousel: 'media' | 'action',
	) => {
		if (isNonNavigationTarget(event.target)) return;
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const swiper =
			carousel === 'media' ? mediaRef.current : actionRef.current;
		if (event.key === 'ArrowLeft') swiper?.slidePrev();
		else swiper?.slideNext();
	};

	/** Resets extraction state while retaining the current media and action. */
	const resetJob = () => {
		setJobState('idle');
		setJobId('');
		setProgress(null);
		setOutputFiles([]);
		setDestination('');
		setChoosingOutput(false);
	};

	/** Clears the selected media and resets dependent workflow state. */
	const clearMedia = async () => {
		if (jobState === 'running' || jobState === 'cancelling') return;
		setError('');
		try {
			await window.mediaApi?.clearSelection();
		} catch (cause) {
			const message =
				cause instanceof Error
					? cause.message
					: 'Could not clear the media.';
			setError(message);
			setAnnouncement(`Could not remove the media. ${message}`);
			return;
		}
		setMedia(null);
		setAction(null);
		setFrameSettings({ samplingMode: 'frameCount', samplingValue: 10 });
		resetJob();
		setError('');
		setAnnouncement('Media selection cleared.');
		setMediaSlide(0);
		mediaRef.current?.slideTo(0);
	};

	/** Inspects a file dropped into the renderer and presents its metadata. */
	const inspect = async (file: File) => {
		setAnalyzing(true);
		setError('');
		try {
			const result = await window.mediaApi.inspectDroppedMedia(file);
			setMedia(result);
			setAction(null);
			resetJob();
			setMediaSlide(1);
			mediaRef.current?.slideTo(1);
			setAnnouncement(
				`Media analysis complete. ${result.name} is ready.`,
			);
			window.setTimeout(
				() =>
					document
						.querySelector<HTMLElement>('#media-review-heading')
						?.focus({ preventScroll: true }),
				0,
			);
		} catch (cause) {
			setMedia(null);
			setAction(null);
			resetJob();
			const message =
				cause instanceof Error
					? cause.message
					: 'The file could not be analyzed.';
			setError(message);
			setAnnouncement(`Media analysis failed. ${message}`);
		} finally {
			setAnalyzing(false);
		}
	};

	/** Opens the native picker and presents metadata for the chosen file. */
	const selectMedia = async () => {
		setAnalyzing(true);
		setError('');
		try {
			const result = await window.mediaApi.selectMedia();
			if (result) {
				setMedia(result);
				setAction(null);
				resetJob();
				setMediaSlide(1);
				mediaRef.current?.slideTo(1);
				setAnnouncement(
					`Media analysis complete. ${result.name} is ready.`,
				);
				window.setTimeout(
					() =>
						document
							.querySelector<HTMLElement>('#media-review-heading')
							?.focus({ preventScroll: true }),
					0,
				);
			}
		} catch (cause) {
			setMedia(null);
			setAction(null);
			resetJob();
			const message =
				cause instanceof Error
					? cause.message
					: 'The file could not be analyzed.';
			setError(message);
			setAnnouncement(`Media analysis failed. ${message}`);
		} finally {
			setAnalyzing(false);
		}
	};

	/** Selects an extraction type and clears state from any previous job. */
	const chooseAction = (next: Action) => {
		setAction(next);
		setError('');
		resetJob();
	};

	/** Starts the configured extraction and handles its terminal result. */
	const startExtraction = async () => {
		if (
			!media ||
			!action ||
			!jobId ||
			!destination ||
			choosingOutput ||
			(action === 'frames' && settingsError)
		)
			return;
		setError('');
		setJobState('running');
		setProgress(0);
		progressAnnouncementRef.current = { percent: 0, time: Date.now() };
		setAnnouncement('Extraction started.');
		try {
			const result = await window.mediaApi.startExtraction(
				action === 'audio'
					? { jobId, kind: 'audio-mp3' }
					: { jobId, kind: 'frames-jpg', settings: frameSettings },
			);
			if (result.status === 'cancelled') {
				setJobState('cancelled');
				setJobId('');
				setDestination('');
				setProgress(null);
				setOutputFiles([]);
				setAnnouncement('Extraction cancelled.');
			} else if (result.status === 'error') {
				setJobState('error');
				setError(result.message);
				setAnnouncement(`Extraction failed. ${result.message}`);
			} else if (result.status === 'success') {
				setJobState('success');
				setProgress(100);
				setDestination(result.outputPath);
				setOutputFiles(
					result.kind === 'frames-jpg' ? result.outputFiles : [],
				);
				setAnnouncement('Extraction complete.');
			}
		} catch (cause) {
			setJobState('error');
			const message =
				cause instanceof Error
					? cause.message
					: 'The extraction failed.';
			setError(message);
			setAnnouncement(`Extraction failed. ${message}`);
		}
	};

	/** Opens the cancellation confirmation and remembers the prior focus target. */
	const requestAbort = () => {
		restoreFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setConfirmOpen(true);
	};

	/** Requests a file or folder destination for a new extraction job. */
	const chooseOutput = async () => {
		if (!media || !action || choosingOutput) return;
		if (action === 'frames' && settingsError) return;
		setError('');
		setChoosingOutput(true);
		const candidateId = createJobId();
		try {
			const selectedPath = await window.mediaApi.chooseOutput({
				jobId: candidateId,
				kind: action === 'audio' ? 'audio-mp3' : 'frames-jpg',
			});
			if (selectedPath) {
				setJobId(candidateId);
				setDestination(selectedPath);
				setOutputFiles([]);
				setProgress(null);
				setAnnouncement(`Output destination selected: ${selectedPath}`);
			}
		} catch (cause) {
			const message =
				cause instanceof Error
					? cause.message
					: 'Could not choose output.';
			setError(message);
			setAnnouncement(`Output selection failed. ${message}`);
		} finally {
			setChoosingOutput(false);
		}
	};

	/** Confirms cancellation and waits for the main process to stop the job. */
	const stopExtraction = async () => {
		restoreFocusRef.current = null;
		setConfirmOpen(false);
		setJobState('cancelling');
		setAnnouncement(
			'Cancellation requested. Waiting for extraction to stop.',
		);
		try {
			await window.mediaApi.abortExtraction(jobId);
		} catch (cause) {
			setJobState('error');
			setError(
				cause instanceof Error
					? cause.message
					: 'Could not abort extraction.',
			);
		}
	};

	/** Opens the completed extraction output in the system file manager. */
	const revealOutput = async () => {
		if (!jobId) return;
		try {
			await window.mediaApi.revealOutput(jobId);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: 'Could not open the output.',
			);
		}
	};

	const stageNames = ['Media', 'Choose extraction', 'Configure and run'];

	return (
		<main className="ganzo-app">
			<header className="app-header">
				<div>
					<p className="eyebrow">Ganzo media tools</p>
					<h1>Media workflow</h1>
				</div>
				<div className="step-indicator" aria-live="polite">
					Step {stage + 1} of 3 · {stageNames[stage]}
				</div>
			</header>

			<nav className="step-nav" aria-label="Workflow stages">
				{stageNames.map((name, index) => (
					<button
						type="button"
						className={index === stage ? 'step current' : 'step'}
						aria-current={index === stage ? 'step' : undefined}
						onClick={() => moveStage(index)}
						disabled={
							jobState === 'running' ||
							jobState === 'cancelling' ||
							index > stage + 1 ||
							(index > 0 && !media) ||
							(index > 1 && !action)
						}
						key={name}
					>
						{index + 1}. {name}
					</button>
				))}
			</nav>

			<p className="sr-only" role="status" aria-live="polite">
				{announcement}
			</p>

			<Swiper
				className="primary-swiper"
				direction="vertical"
				slidesPerView={1}
				mousewheel={{
					enabled: !jobBusy,
					forceToAxis: true,
					releaseOnEdges: true,
				}}
				modules={[Mousewheel]}
				allowTouchMove={!jobBusy}
				allowSlidePrev={!jobBusy}
				allowSlideNext={canSwipeForward}
				tabIndex={0}
				aria-label="Workflow stages"
				onKeyDownCapture={handleStageKeyDown}
				onSwiper={(swiper) => {
					verticalRef.current = swiper;
				}}
				onSlideChange={handleStageSlideChange}
			>
				<SwiperSlide aria-hidden={stage !== 0} inert={stage !== 0}>
					<section className="stage">
						<h2
							ref={(element) => {
								stageHeadingRefs.current[0] = element;
							}}
							tabIndex={-1}
						>
							Media
						</h2>
						<Swiper
							className="carousel"
							slidesPerView={1}
							modules={[]}
							tabIndex={0}
							onKeyDownCapture={(event) =>
								handleCarouselKeyDown(event, 'media')
							}
							onSwiper={(swiper) => {
								mediaRef.current = swiper;
							}}
							onSlideChange={(swiper) =>
								setMediaSlide(swiper.activeIndex)
							}
							aria-label="Media selection and review, use left and right arrow keys to change views"
						>
							<SwiperSlide
								aria-hidden={stage !== 0 || mediaSlide !== 0}
								inert={stage !== 0 || mediaSlide !== 0}
							>
								<div
									className={
										dragActive
											? 'drop-zone active'
											: 'drop-zone'
									}
									onDragEnter={(event) => {
										event.preventDefault();
										setDragActive(true);
									}}
									onDragOver={(event) =>
										event.preventDefault()
									}
									onDragLeave={(event) => {
										if (
											!event.currentTarget.contains(
												event.relatedTarget as Node,
											)
										)
											setDragActive(false);
									}}
									onDrop={(event) => {
										event.preventDefault();
										setDragActive(false);
										const file =
											event.dataTransfer.files.item?.(
												0,
											) ??
											(
												event.dataTransfer
													.files as unknown as File[]
											)[0];
										if (file) void inspect(file);
									}}
								>
									<strong>
										{dragActive
											? 'Drop media here'
											: 'Choose or drag a media file'}
									</strong>
									<p>
										Supported audio and video files. The
										first dropped file is used.
									</p>
									<button
										type="button"
										onClick={() => void selectMedia()}
										disabled={analyzing}
									>
										{analyzing
											? 'Analyzing…'
											: 'Choose media'}
									</button>
								</div>
							</SwiperSlide>
							<SwiperSlide
								aria-hidden={stage !== 0 || mediaSlide !== 1}
								inert={stage !== 0 || mediaSlide !== 1}
							>
								{media ? (
									<div className="media-review">
										<h3
											id="media-review-heading"
											tabIndex={-1}
										>
											Review media
										</h3>
										<dl>
											{metadataRows(media).map(
												([label, value]) => (
													<div key={label}>
														<dt>{label}</dt>
														<dd>{value}</dd>
													</div>
												),
											)}
										</dl>
										<div className="button-row">
											<button
												type="button"
												className="primary"
												onClick={() => moveStage(1)}
											>
												Use this media
											</button>
											<button
												type="button"
												onClick={() =>
													void selectMedia()
												}
												disabled={analyzing}
											>
												Choose another file
											</button>
											<button
												type="button"
												className="danger-text"
												onClick={() =>
													void clearMedia()
												}
											>
												Remove selection
											</button>
										</div>
									</div>
								) : (
									<p>No media selected.</p>
								)}
							</SwiperSlide>
						</Swiper>
						<div className="carousel-nav">
							<button
								type="button"
								onClick={() => mediaRef.current?.slidePrev()}
								disabled={mediaSlide === 0}
							>
								Previous media view
							</button>
							<span aria-live="polite">
								Media view {mediaSlide + 1} of 2
							</span>
							<button
								type="button"
								onClick={() => mediaRef.current?.slideNext()}
								disabled={!media || mediaSlide === 1}
							>
								Next media view
							</button>
						</div>
						{error && (
							<div className="alert" role="alert">
								{error}
							</div>
						)}
						<div className="stage-nav">
							<button
								type="button"
								className="primary"
								onClick={() => moveStage(1)}
								disabled={!media}
							>
								Continue to extraction
							</button>
						</div>
					</section>
				</SwiperSlide>

				<SwiperSlide aria-hidden={stage !== 1} inert={stage !== 1}>
					<section className="stage">
						<h2
							ref={(element) => {
								stageHeadingRefs.current[1] = element;
							}}
							tabIndex={-1}
						>
							Choose extraction
						</h2>
						<Swiper
							className="carousel action-carousel"
							slidesPerView={1}
							modules={[]}
							tabIndex={0}
							onKeyDownCapture={(event) =>
								handleCarouselKeyDown(event, 'action')
							}
							onSwiper={(swiper) => {
								actionRef.current = swiper;
							}}
							onSlideChange={(swiper) =>
								setActionSlide(swiper.activeIndex)
							}
							aria-label="Extraction action choices, use left and right arrow keys to change actions"
						>
							{[
								{
									key: 'audio',
									title: 'Extract audio to MP3',
									available: media?.audioCodec != null,
									text: 'Create a 44.1 kHz stereo 192 kb/s MP3.',
								},
								{
									key: 'frames',
									title: 'Extract frames to JPG',
									available: media != null,
									text: 'Create numbered JPG frames in a chosen folder.',
								},
							].map((card, index) => (
								<SwiperSlide
									key={card.key}
									aria-hidden={
										stage !== 1 || actionSlide !== index
									}
									inert={stage !== 1 || actionSlide !== index}
								>
									<article className="action-card">
										<h3>{card.title}</h3>
										<p>
											{card.available
												? card.text
												: 'Not available for this media.'}
										</p>
										{card.available ? (
											<button
												type="button"
												className={
													action === card.key
														? 'selected'
														: 'primary'
												}
												aria-pressed={
													action === card.key
												}
												onClick={() =>
													chooseAction(
														card.key as Action,
													)
												}
											>
												{action === card.key
													? 'Selected'
													: 'Select action'}
											</button>
										) : (
											<span className="unavailable">
												Not available yet
											</span>
										)}
									</article>
								</SwiperSlide>
							))}
							{[
								['Change format', 'Not available yet'],
								['Add watermark', 'Not available yet'],
								['Replace audio', 'Not available yet'],
							].map(([title, reason], index) => (
								<SwiperSlide
									key={title}
									aria-hidden={
										stage !== 1 || actionSlide !== index + 2
									}
									inert={
										stage !== 1 || actionSlide !== index + 2
									}
								>
									<article
										className="action-card unavailable-card"
										aria-label={`${title}, unavailable`}
									>
										<h3>{title}</h3>
										<p>{reason}</p>
										<button type="button" disabled>
											Not available
										</button>
									</article>
								</SwiperSlide>
							))}
						</Swiper>
						<div className="carousel-nav">
							<button
								type="button"
								onClick={() => actionRef.current?.slidePrev()}
								disabled={actionSlide === 0}
							>
								Previous action
							</button>
							<span aria-live="polite">
								Action {actionSlide + 1} of 5
							</span>
							<button
								type="button"
								onClick={() => actionRef.current?.slideNext()}
								disabled={actionSlide === 4}
							>
								Next action
							</button>
						</div>
						{action && (
							<p className="selection-status" role="status">
								Selected:{' '}
								{action === 'audio'
									? 'Extract audio to MP3'
									: 'Extract frames to JPG'}
							</p>
						)}
						<div className="stage-nav">
							<button type="button" onClick={() => moveStage(0)}>
								Previous
							</button>
							<button
								type="button"
								className="primary"
								onClick={() => moveStage(2)}
								disabled={!action}
							>
								Continue to configure
							</button>
						</div>
					</section>
				</SwiperSlide>

				<SwiperSlide aria-hidden={stage !== 2} inert={stage !== 2}>
					<section className="stage">
						<h2
							ref={(element) => {
								stageHeadingRefs.current[2] = element;
							}}
							tabIndex={-1}
						>
							Configure and run
						</h2>
						{media && action && (
							<>
								<div className="run-summary">
									<p>
										<strong>Source:</strong> {media.name}
									</p>
									<p>
										<strong>Action:</strong>{' '}
										{action === 'audio'
											? 'MP3 audio extraction'
											: 'JPG frame extraction'}
									</p>
									<p>
										<strong>Output:</strong>{' '}
										{destination || 'Not chosen'}
									</p>
								</div>

								{action === 'frames' && jobState === 'idle' && (
									<fieldset className="frame-settings">
										<legend>JPG frame settings</legend>
										<div className="settings-field">
											<label htmlFor="start-time">
												Start time (seconds)
											</label>
											<input
												id="start-time"
												type="number"
												min="0"
												step="0.1"
												aria-invalid={Boolean(
													settingsErrors.startSeconds,
												)}
												aria-describedby={
													settingsErrors.startSeconds
														? 'start-time-error'
														: undefined
												}
												value={
													frameSettings.startSeconds ??
													''
												}
												onChange={(event) =>
													setFrameSettings({
														...frameSettings,
														startSeconds:
															event.target
																.value === ''
																? undefined
																: Number(
																		event
																			.target
																			.value,
																	),
													})
												}
											/>
											{settingsErrors.startSeconds && (
												<span
													id="start-time-error"
													className="field-error"
													role="alert"
												>
													{
														settingsErrors.startSeconds
													}
												</span>
											)}
										</div>
										<div className="settings-field">
											<label htmlFor="duration">
												Duration (seconds)
											</label>
											<input
												id="duration"
												type="number"
												min="0.1"
												step="0.1"
												aria-invalid={Boolean(
													settingsErrors.durationSeconds,
												)}
												aria-describedby={
													settingsErrors.durationSeconds
														? 'duration-error'
														: undefined
												}
												value={
													frameSettings.durationSeconds ??
													''
												}
												onChange={(event) =>
													setFrameSettings({
														...frameSettings,
														durationSeconds:
															event.target
																.value === ''
																? undefined
																: Number(
																		event
																			.target
																			.value,
																	),
													})
												}
											/>
											{settingsErrors.durationSeconds && (
												<span
													id="duration-error"
													className="field-error"
													role="alert"
												>
													{
														settingsErrors.durationSeconds
													}
												</span>
											)}
										</div>
										<div className="settings-field">
											<label htmlFor="output-size">
												Output size (WIDTHxHEIGHT)
											</label>
											<input
												id="output-size"
												type="text"
												placeholder="1280x720"
												aria-invalid={Boolean(
													settingsErrors.size,
												)}
												aria-describedby={
													settingsErrors.size
														? 'output-size-error'
														: undefined
												}
												value={frameSettings.size ?? ''}
												onChange={(event) =>
													setFrameSettings({
														...frameSettings,
														size:
															event.target
																.value ||
															undefined,
													})
												}
											/>
											{settingsErrors.size && (
												<span
													id="output-size-error"
													className="field-error"
													role="alert"
												>
													{settingsErrors.size}
												</span>
											)}
										</div>
										<div className="settings-field">
											<label htmlFor="sampling-mode">
												Sampling mode
											</label>
											<select
												id="sampling-mode"
												value={
													frameSettings.samplingMode ??
													''
												}
												aria-invalid={Boolean(
													settingsErrors.samplingMode,
												)}
												aria-describedby={
													settingsErrors.samplingMode
														? 'sampling-mode-error'
														: undefined
												}
												onChange={(event) =>
													setFrameSettings({
														...frameSettings,
														samplingMode: event
															.target
															.value as FrameSamplingMode,
													})
												}
											>
												<option value="frameInterval">
													Every N frames
												</option>
												<option value="timeInterval">
													Every N seconds
												</option>
												<option value="percentage">
													Every N percent
												</option>
												<option value="frameRate">
													Frames per second
												</option>
												<option value="frameCount">
													Number of frames
												</option>
											</select>
											{settingsErrors.samplingMode && (
												<span
													id="sampling-mode-error"
													className="field-error"
													role="alert"
												>
													{
														settingsErrors.samplingMode
													}
												</span>
											)}
										</div>
										<div className="settings-field">
											<label htmlFor="sampling-value">
												Sampling value
											</label>
											<input
												id="sampling-value"
												type="number"
												min="1"
												value={
													frameSettings.samplingValue ??
													''
												}
												aria-invalid={Boolean(
													settingsErrors.samplingValue,
												)}
												aria-describedby={
													settingsErrors.samplingValue
														? 'sampling-value-error'
														: undefined
												}
												onChange={(event) =>
													setFrameSettings({
														...frameSettings,
														samplingValue:
															event.target
																.value === ''
																? undefined
																: Number(
																		event
																			.target
																			.value,
																	),
													})
												}
											/>
											{settingsErrors.samplingValue && (
												<span
													id="sampling-value-error"
													className="field-error"
													role="alert"
												>
													{
														settingsErrors.samplingValue
													}
												</span>
											)}
										</div>
									</fieldset>
								)}

								{jobState === 'idle' && (
									<>
										<button
											type="button"
											className="primary"
											onClick={() => void chooseOutput()}
											disabled={
												choosingOutput ||
												(action === 'frames' &&
													Boolean(settingsError))
											}
										>
											{choosingOutput
												? 'Choosing output…'
												: `Choose output ${action === 'audio' ? 'file' : 'folder'}`}
										</button>
										{destination && (
											<p role="status">{destination}</p>
										)}
										<button
											type="button"
											className="start"
											onClick={() =>
												void startExtraction()
											}
											disabled={
												!media ||
												!action ||
												!destination ||
												!jobId ||
												choosingOutput ||
												(action === 'frames' &&
													Boolean(settingsError))
											}
										>
											Start extraction
										</button>
									</>
								)}

								{jobState === 'running' && (
									<div className="job-state" aria-live="off">
										<h3
											ref={jobStateHeadingRef}
											tabIndex={-1}
										>
											Running extraction
										</h3>
										{progress == null ? (
											<progress aria-label="Extraction progress" />
										) : (
											<>
												<progress
													max="100"
													value={progress}
													aria-label={`${Math.round(progress)} percent extraction progress`}
												/>
												<strong>
													{progress.toFixed(0)}%
												</strong>
											</>
										)}
										<button
											type="button"
											className="danger"
											onClick={requestAbort}
										>
											Cancel extraction
										</button>
									</div>
								)}

								{jobState === 'cancelling' && (
									<div className="job-state" aria-live="off">
										<h3
											ref={jobStateHeadingRef}
											tabIndex={-1}
										>
											Cancelling extraction…
										</h3>
										<progress aria-label="Stopping extraction" />
									</div>
								)}
								{jobState === 'cancelled' && (
									<div className="job-state" role="status">
										<h3
											ref={jobStateHeadingRef}
											tabIndex={-1}
										>
											Extraction cancelled
										</h3>
										<button
											type="button"
											onClick={() => {
												resetJob();
												setAction(action);
											}}
										>
											Start another extraction
										</button>
									</div>
								)}
								{jobState === 'success' && (
									<div
										className="job-state success"
										role="status"
									>
										<h3>Extraction complete</h3>
										<p>
											{outputFiles.length
												? `${outputFiles.length} JPG frames`
												: 'MP3 audio'}
										</p>
										<p>
											<strong>Output:</strong>{' '}
											{destination}
										</p>
										<div className="button-row">
											<button
												type="button"
												className="primary"
												onClick={() =>
													void revealOutput()
												}
											>
												Show output in file manager
											</button>
											<button
												type="button"
												onClick={() => {
													resetJob();
													setAction(action);
												}}
											>
												Start another extraction
											</button>
										</div>
									</div>
								)}
								{jobState === 'error' && (
									<div className="alert" role="alert">
										<strong>Extraction failed</strong>
										<p>{error}</p>
										<div className="button-row">
											<button
												type="button"
												onClick={() => resetJob()}
											>
												Try again
											</button>
											<button
												type="button"
												onClick={() => moveStage(0)}
											>
												Choose another media file
											</button>
										</div>
									</div>
								)}
							</>
						)}
						{error && jobState !== 'error' && (
							<div className="alert" role="alert">
								{error}
							</div>
						)}
						{jobState === 'idle' && (
							<div className="stage-nav">
								<button
									type="button"
									onClick={() => moveStage(1)}
								>
									Previous
								</button>
							</div>
						)}
					</section>
				</SwiperSlide>
			</Swiper>

			{confirmOpen && (
				<div
					className="dialog-backdrop"
					role="presentation"
					onClick={(event) => {
						if (event.target === event.currentTarget)
							setConfirmOpen(false);
					}}
				>
					<div
						className="dialog"
						ref={confirmDialogRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby="cancel-title"
						tabIndex={-1}
					>
						<h2 id="cancel-title">Stop extraction?</h2>
						<p>
							The in-progress extraction will stop and partial
							output will be removed.
						</p>
						<div className="button-row">
							<button
								type="button"
								ref={keepButtonRef}
								onClick={() => setConfirmOpen(false)}
							>
								Keep extracting
							</button>
							<button
								type="button"
								className="danger"
								onClick={() => void stopExtraction()}
							>
								Stop extraction
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
