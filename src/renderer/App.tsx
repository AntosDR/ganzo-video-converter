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
	AudioExtractSettings,
	AudioReplaceSettings,
	FrameSettings,
	MediaDescriptor,
	StartExtractionRequest,
} from '../shared/media-contract';
import { AppOverlay } from './components/common/AppOverlay';
import { ConfirmAbortDialog } from './components/common/ConfirmAbortDialog';
import { ActionStageView } from './components/views/ActionStageView';
import { ConfigureStageView } from './components/views/ConfigureStageView';
import { MediaStageView } from './components/views/MediaStageView';
import type { Action, JobState } from './types/workflow';
import {
	STAGE_NAMES,
	audioReplaceSettingsError,
	createJobId,
	frameSettingsError,
	isEditableTarget,
	isNonNavigationTarget,
} from './utils/media-workflow';
import './App.css';

const DEFAULT_AUDIO_EXTRACT_SETTINGS: AudioExtractSettings = {
	format: 'mp3',
	bitrate: '192k',
	sampleRate: 44100,
};

const DEFAULT_AUDIO_REPLACE_SETTINGS: AudioReplaceSettings = {
	audioPath: '',
	mode: 'replace',
};

const DEFAULT_FRAME_SETTINGS: FrameSettings = {
	samplingMode: 'frameCount',
	samplingValue: 10,
};

/**
 * Coordinates the three-stage media conversion workflow across view components
 * and delegates filesystem, media inspection, and FFmpeg work to the main-process API.
 */
export default function App() {
	const verticalRef = useRef<SwiperInstance | null>(null);
	const mediaRef = useRef<SwiperInstance | null>(null);
	const actionRef = useRef<SwiperInstance | null>(null);
	const stageHeadingRefs = useRef<Array<HTMLHeadingElement | null>>([]);
	const jobStateHeadingRef = useRef<HTMLHeadingElement | null>(null);
	const previousStageRef = useRef(0);
	const progressAnnouncementRef = useRef({ percent: 0, time: 0 });

	const [stage, setStage] = useState(0);
	const [mediaSlide, setMediaSlide] = useState(0);
	const [actionSlide, setActionSlide] = useState(0);
	const [media, setMedia] = useState<MediaDescriptor | null>(null);
	const [analyzing, setAnalyzing] = useState(false);
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
	const [audioExtractSettings, setAudioExtractSettings] =
		useState<AudioExtractSettings>(DEFAULT_AUDIO_EXTRACT_SETTINGS);
	const [audioReplaceSettings, setAudioReplaceSettings] =
		useState<AudioReplaceSettings>(DEFAULT_AUDIO_REPLACE_SETTINGS);
	const [secondaryAudioName, setSecondaryAudioName] = useState('');
	const [frameSettings, setFrameSettings] = useState<FrameSettings>(
		DEFAULT_FRAME_SETTINGS,
	);

	const settingsErrors = frameSettingsError(
		frameSettings,
		media?.durationSeconds ?? null,
	);
	const audioReplaceErrors = audioReplaceSettingsError(
		audioReplaceSettings,
		media?.audioCodec != null,
	);
	const hasFrameError = Object.values(settingsErrors).some(Boolean);
	const hasAudioReplaceError =
		Object.values(audioReplaceErrors).some(Boolean);
	const hasSettingsError =
		(action === 'frames' && hasFrameError) ||
		(action === 'audio-replace' && hasAudioReplaceError);
	const jobBusy = jobState === 'running' || jobState === 'cancelling';
	const canSwipeForward =
		!jobBusy &&
		((stage === 0 && Boolean(media)) ||
			(stage >= 1 && Boolean(media && action)));

	// Mirror latest gating state for synchronous Swiper slide-change callbacks.
	const workflowRef = useRef({ stage, media, action, jobBusy });

	useEffect(() => {
		workflowRef.current = { stage, media, action, jobBusy };
	}, [stage, media, action, jobBusy]);

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
		if (mediaRef.current?.activeIndex === mediaSlide) return;
		mediaRef.current?.slideTo(mediaSlide);
	}, [mediaSlide, media]);

	useEffect(() => {
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || confirmOpen) return;
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			if (isEditableTarget(event.target)) return;

			if (stage === 0) {
				if (!media) return;
				event.preventDefault();
				if (event.key === 'ArrowLeft') mediaRef.current?.slidePrev();
				else mediaRef.current?.slideNext();
			} else if (stage === 1) {
				event.preventDefault();
				if (event.key === 'ArrowLeft') actionRef.current?.slidePrev();
				else actionRef.current?.slideNext();
			}
		};
		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => window.removeEventListener('keydown', handleGlobalKeyDown);
	}, [stage, media, confirmOpen]);

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
				// Throttle polite live announcements to every 10% or 15 seconds.
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

	/** Checks whether the workflow can navigate to the requested vertical stage. */
	const canMoveStage = (next: number) => {
		const current = workflowRef.current;
		if (next < 0 || next > 2 || current.jobBusy) return false;
		if (next > current.stage + 1) return false;
		if (next > current.stage && current.stage === 0 && !current.media)
			return false;
		if (next > current.stage && current.stage === 1 && !current.action)
			return false;
		if (next > 0 && !current.media) return false;
		if (next > 1 && !current.action) return false;
		return true;
	};

	/** Navigates to a stage only when its prerequisite selections are complete. */
	const moveStage = (next: number) => {
		if (!canMoveStage(next)) return;
		setStage(next);
		verticalRef.current?.slideTo(next);
	};

	/** Keeps touch/wheel swipe navigation synchronized with gated workflow state. */
	const handleStageSlideChange = (swiper: SwiperInstance) => {
		const next = swiper.activeIndex;
		if (!canMoveStage(next)) {
			swiper.slideTo(workflowRef.current.stage, 0);
			return;
		}
		if (next !== workflowRef.current.stage) setStage(next);
	};

	/** Maps vertical arrow keys to stage navigation outside interactive controls. */
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

	/** Resets extraction job state while keeping the selected media and action. */
	const resetJob = () => {
		setJobState('idle');
		setJobId('');
		setProgress(null);
		setOutputFiles([]);
		setDestination('');
		setChoosingOutput(false);
	};

	/** Applies inspected media metadata and advances the first carousel to review. */
	const applyInspectedMedia = (result: MediaDescriptor) => {
		setMedia(result);
		setAction(null);
		resetJob();
		setMediaSlide(1);
		setAnnouncement(`Media analysis complete. ${result.name} is ready.`);
		window.setTimeout(
			() =>
				document
					.querySelector<HTMLElement>('#media-review-heading')
					?.focus({ preventScroll: true }),
			0,
		);
	};

	/** Clears stale media state and announces inspection failures. */
	const handleInspectionError = (cause: unknown) => {
		setMedia(null);
		setAction(null);
		resetJob();
		const message =
			cause instanceof Error
				? cause.message
				: 'The file could not be analyzed.';
		setError(message);
		setAnnouncement(`Media analysis failed. ${message}`);
	};

	/** Clears the selected media via IPC and resets dependent workflow state. */
	const clearMedia = async () => {
		if (jobBusy) return;
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
		setAudioExtractSettings(DEFAULT_AUDIO_EXTRACT_SETTINGS);
		setAudioReplaceSettings(DEFAULT_AUDIO_REPLACE_SETTINGS);
		setSecondaryAudioName('');
		setFrameSettings(DEFAULT_FRAME_SETTINGS);
		resetJob();
		setError('');
		setAnnouncement('Media selection cleared.');
		setMediaSlide(0);
	};

	/** Inspects a file dropped into the renderer and presents its metadata. */
	const inspectDroppedFile = async (file: File) => {
		setAnalyzing(true);
		setError('');
		try {
			const result = await window.mediaApi.inspectDroppedMedia(file);
			applyInspectedMedia(result);
		} catch (cause) {
			handleInspectionError(cause);
		} finally {
			setAnalyzing(false);
		}
	};

	/** Opens the native media picker and presents metadata for the chosen file. */
	const selectMedia = async () => {
		setAnalyzing(true);
		setError('');
		try {
			const result = await window.mediaApi.selectMedia();
			if (result) applyInspectedMedia(result);
		} catch (cause) {
			handleInspectionError(cause);
		} finally {
			setAnalyzing(false);
		}
	};

	/** Selects an extraction type, clears previous job state, and opens configuration. */
	const chooseAction = (next: Action) => {
		setAction(next);
		setError('');
		resetJob();
		if (!jobBusy && media) setStage(2);
	};

	/** Updates audio extraction settings and clears any stale output path when format changes. */
	const handleAudioExtractSettingsChange = (next: AudioExtractSettings) => {
		if (next.format !== audioExtractSettings.format && destination) {
			setDestination('');
			setJobId('');
		}
		setAudioExtractSettings(next);
	};

	/** Opens the native picker for a secondary audio file to replace or mix. */
	const selectAudioFile = async () => {
		setError('');
		try {
			const picked = await window.mediaApi.selectAudioFile();
			if (picked) {
				setAudioReplaceSettings((prev) => ({
					...prev,
					audioPath: picked.path,
				}));
				setSecondaryAudioName(picked.name);
				setAnnouncement(`Audio file selected: ${picked.name}`);
			}
		} catch (cause) {
			const message =
				cause instanceof Error
					? cause.message
					: 'Could not select audio file.';
			setError(message);
			setAnnouncement(`Audio selection failed. ${message}`);
		}
	};

	/** Maps the active UI action to its main-process extraction kind. */
	const actionToKind = (
		currentAction: Action,
	): StartExtractionRequest['kind'] => {
		switch (currentAction) {
			case 'audio':
				return 'audio-extract';
			case 'audio-replace':
				return 'audio-replace';
			case 'audio-mute':
				return 'audio-mute';
			case 'cover':
				return 'cover-jpg';
			case 'frames':
				return 'frames-jpg';
		}
	};

	/** Requests a file or folder destination for a new extraction job. */
	const chooseOutput = async () => {
		if (!media || !action || choosingOutput || hasSettingsError) return;
		setError('');
		setChoosingOutput(true);
		const candidateId = createJobId();
		try {
			const selectedPath = await window.mediaApi.chooseOutput({
				jobId: candidateId,
				kind: actionToKind(action),
				format:
					action === 'audio'
						? audioExtractSettings.format
						: undefined,
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

	/** Starts the configured extraction and handles its terminal result. */
	const startExtraction = async () => {
		if (
			!media ||
			!action ||
			!jobId ||
			!destination ||
			choosingOutput ||
			hasSettingsError
		)
			return;
		setError('');
		setJobState('running');
		setProgress(0);
		progressAnnouncementRef.current = { percent: 0, time: Date.now() };
		setAnnouncement('Extraction started.');
		try {
			const request: StartExtractionRequest =
				action === 'audio'
					? {
							jobId,
							kind: 'audio-extract',
							settings: audioExtractSettings,
						}
					: action === 'audio-replace'
						? {
								jobId,
								kind: 'audio-replace',
								settings: audioReplaceSettings,
							}
						: action === 'audio-mute'
							? { jobId, kind: 'audio-mute' }
							: action === 'cover'
								? { jobId, kind: 'cover-jpg' }
								: {
										jobId,
										kind: 'frames-jpg',
										settings: frameSettings,
									};
			const result = await window.mediaApi.startExtraction(request);
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

	/** Confirms cancellation and waits for the main process to stop the job. */
	const stopExtraction = async () => {
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

	return (
		<main className="ganzo-app">
			<AppOverlay stage={stage} stageNames={STAGE_NAMES} />

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
					<MediaStageView
						isActiveStage={stage === 0}
						mediaSlide={mediaSlide}
						media={media}
						analyzing={analyzing}
						error={error}
						headingRef={(element) => {
							stageHeadingRefs.current[0] = element;
						}}
						mediaSwiperRef={mediaRef}
						onSlideChange={setMediaSlide}
						onSelectMedia={selectMedia}
						onInspectDroppedFile={inspectDroppedFile}
						onUseMedia={() => moveStage(1)}
						onClearMedia={clearMedia}
					/>
				</SwiperSlide>

				<SwiperSlide aria-hidden={stage !== 1} inert={stage !== 1}>
					<ActionStageView
						isActiveStage={stage === 1}
						actionSlide={actionSlide}
						media={media}
						headingRef={(element) => {
							stageHeadingRefs.current[1] = element;
						}}
						actionSwiperRef={actionRef}
						onSlideChange={setActionSlide}
						onChooseAction={chooseAction}
						onPreviousStage={() => moveStage(0)}
					/>
				</SwiperSlide>

				<SwiperSlide aria-hidden={stage !== 2} inert={stage !== 2}>
					<ConfigureStageView
						media={media}
						action={action}
						jobState={jobState}
						jobId={jobId}
						destination={destination}
						choosingOutput={choosingOutput}
						audioExtractSettings={audioExtractSettings}
						audioReplaceSettings={audioReplaceSettings}
						secondaryAudioName={secondaryAudioName}
						audioReplaceErrors={audioReplaceErrors}
						frameSettings={frameSettings}
						settingsErrors={settingsErrors}
						hasSettingsError={hasSettingsError}
						progress={progress}
						outputFiles={outputFiles}
						error={error}
						headingRef={(element) => {
							stageHeadingRefs.current[2] = element;
						}}
						jobStateHeadingRef={(element) => {
							jobStateHeadingRef.current = element;
						}}
						onChangeAudioExtractSettings={
							handleAudioExtractSettingsChange
						}
						onChangeAudioReplaceSettings={setAudioReplaceSettings}
						onSelectAudioFile={selectAudioFile}
						onChangeFrameSettings={setFrameSettings}
						onChooseOutput={chooseOutput}
						onStartExtraction={startExtraction}
						onRequestAbort={() => setConfirmOpen(true)}
						onRevealOutput={revealOutput}
						onResetJob={resetJob}
						onMoveStage={moveStage}
					/>
				</SwiperSlide>
			</Swiper>

			<ConfirmAbortDialog
				open={confirmOpen}
				onCancel={() => setConfirmOpen(false)}
				onConfirmStop={stopExtraction}
			/>
		</main>
	);
}
