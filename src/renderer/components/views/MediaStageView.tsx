import { useState, type RefObject } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import type { MediaDescriptor } from '../../../shared/media-contract';
import type { CarouselDotItem } from '../../types/workflow';
import { metadataRows } from '../../utils/media-workflow';
import { CarouselDots } from '../common/CarouselDots';

/** Props for {@link MediaStageView}. */
export interface MediaStageViewProps {
	/** Whether Stage 1 (Media) is the currently active vertical stage. */
	isActiveStage: boolean;
	/** Zero-based index of the active horizontal media slide (`0`: picker, `1`: review). */
	mediaSlide: number;
	/** Inspected media descriptor, or `null` before a file is chosen. */
	media: MediaDescriptor | null;
	/** Indicates an ongoing media inspection IPC call. */
	analyzing: boolean;
	/** Error message from media selection, drag-and-drop inspection, or clearing. */
	error: string;
	/** Ref attached to the stage heading for programmatic focus on stage changes. */
	headingRef: (element: HTMLHeadingElement | null) => void;
	/** Ref holding the horizontal media Swiper instance. */
	mediaSwiperRef: RefObject<SwiperInstance | null>;
	/** Updates active horizontal slide index when Swiper transitions. */
	onSlideChange: (index: number) => void;
	/** Opens the native OS media file picker. */
	onSelectMedia: () => void | Promise<void>;
	/** Inspects a file dropped into the drop zone. */
	onInspectDroppedFile: (file: File) => void | Promise<void>;
	/** Confirms the selected media and advances to action selection. */
	onUseMedia: () => void;
	/** Clears the selected media and returns to the picker slide. */
	onClearMedia: () => void | Promise<void>;
}

/**
 * First workflow view allowing users to pick or drag-and-drop a media file
 * and review its inspected metadata before proceeding to extraction.
 */
export function MediaStageView({
	isActiveStage,
	mediaSlide,
	media,
	analyzing,
	error,
	headingRef,
	mediaSwiperRef,
	onSlideChange,
	onSelectMedia,
	onInspectDroppedFile,
	onUseMedia,
	onClearMedia,
}: MediaStageViewProps) {
	const [dragActive, setDragActive] = useState(false);

	const mediaDotItems: CarouselDotItem[] = [
		{ label: 'Media view 1 of 2: Select media' },
		{ label: 'Media view 2 of 2: Review media', disabled: !media },
	];

	return (
		<section className="stage">
			<h2 ref={headingRef} tabIndex={-1}>
				Media
			</h2>
			<Swiper
				className="carousel"
				slidesPerView={1}
				modules={[]}
				allowTouchMove={Boolean(media)}
				allowSlideNext={Boolean(media)}
				tabIndex={0}
				onSwiper={(swiper) => {
					mediaSwiperRef.current = swiper;
				}}
				onSlideChange={(swiper) => onSlideChange(swiper.activeIndex)}
				aria-label="Media selection and review, use left and right arrow keys to change views"
			>
				<SwiperSlide
					aria-hidden={!isActiveStage || mediaSlide !== 0}
					inert={!isActiveStage || mediaSlide !== 0}
				>
					<div
						className={
							dragActive ? 'drop-zone active' : 'drop-zone'
						}
						onDragEnter={(event) => {
							event.preventDefault();
							setDragActive(true);
						}}
						onDragOver={(event) => event.preventDefault()}
						onDragLeave={(event) => {
							// Ignore dragleave events bubbling from child text or button elements.
							if (
								!event.currentTarget.contains(
									event.relatedTarget as Node,
								)
							) {
								setDragActive(false);
							}
						}}
						onDrop={(event) => {
							event.preventDefault();
							setDragActive(false);
							const file =
								event.dataTransfer.files.item?.(0) ??
								(
									event.dataTransfer
										.files as unknown as File[]
								)[0];
							if (file) void onInspectDroppedFile(file);
						}}
					>
						<strong>
							{dragActive
								? 'Drop media here'
								: 'Choose or drag a media file'}
						</strong>
						<p>
							Supported audio and video files. The first dropped
							file is used.
						</p>
						<button
							type="button"
							className="primary"
							onClick={() => void onSelectMedia()}
							disabled={analyzing}
						>
							{analyzing ? 'Analyzing…' : 'Choose media'}
						</button>
					</div>
				</SwiperSlide>
				<SwiperSlide
					aria-hidden={!isActiveStage || mediaSlide !== 1}
					inert={!isActiveStage || mediaSlide !== 1}
				>
					{media ? (
						<div className="media-review">
							<h3 id="media-review-heading" tabIndex={-1}>
								Review media
							</h3>
							<dl>
								{metadataRows(media).map(([label, value]) => (
									<div key={label}>
										<dt>{label}</dt>
										<dd>{value}</dd>
									</div>
								))}
							</dl>
							<div className="button-row">
								<button
									type="button"
									className="primary"
									onClick={onUseMedia}
								>
									Use this media
								</button>
								<button
									type="button"
									onClick={() => void onSelectMedia()}
									disabled={analyzing}
								>
									Choose another file
								</button>
								<button
									type="button"
									className="danger-text"
									onClick={() => void onClearMedia()}
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
			<CarouselDots
				items={mediaDotItems}
				activeIndex={mediaSlide}
				label="Media views"
				liveText={`Media view ${mediaSlide + 1} of 2`}
				onSelect={(index) => {
					if (index === 1 && !media) return;
					mediaSwiperRef.current?.slideTo(index);
				}}
			/>
			{error && (
				<div className="alert" role="alert">
					{error}
				</div>
			)}
		</section>
	);
}
