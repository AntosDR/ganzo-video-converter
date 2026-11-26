import type { RefObject } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import type { MediaDescriptor } from '../../../shared/media-contract';
import type { Action, CarouselDotItem } from '../../types/workflow';
import {
	AVAILABLE_ACTIONS,
	PLACEHOLDER_ACTIONS,
} from '../../utils/media-workflow';
import { CarouselDots } from '../common/CarouselDots';

/** Props for {@link ActionStageView}. */
export interface ActionStageViewProps {
	/** Whether Stage 2 (Choose extraction) is the active vertical stage. */
	isActiveStage: boolean;
	/** Zero-based index of the currently focused action card. */
	actionSlide: number;
	/** Currently inspected media descriptor used to check action availability. */
	media: MediaDescriptor | null;
	/** Ref attached to the stage heading for programmatic focus on stage changes. */
	headingRef: (element: HTMLHeadingElement | null) => void;
	/** Ref holding the horizontal action Swiper instance. */
	actionSwiperRef: RefObject<SwiperInstance | null>;
	/** Updates active action slide index when Swiper transitions. */
	onSlideChange: (index: number) => void;
	/** Selects an extraction action and immediately advances to configuration. */
	onChooseAction: (action: Action) => void;
	/** Returns to the previous workflow stage. */
	onPreviousStage: () => void;
}

/**
 * Second workflow view presenting available and upcoming media actions in a
 * horizontal carousel flanked by large side navigation arrows and animated dots.
 */
export function ActionStageView({
	isActiveStage,
	actionSlide,
	media,
	headingRef,
	actionSwiperRef,
	onSlideChange,
	onChooseAction,
	onPreviousStage,
}: ActionStageViewProps) {
	const totalSlides = AVAILABLE_ACTIONS.length + PLACEHOLDER_ACTIONS.length;
	const actionDotItems: CarouselDotItem[] = [
		...AVAILABLE_ACTIONS.map((card, index) => ({
			label: `Action ${index + 1} of ${totalSlides}: ${card.title}`,
		})),
		...PLACEHOLDER_ACTIONS.map(([title], index) => ({
			label: `Action ${index + AVAILABLE_ACTIONS.length + 1} of ${totalSlides}: ${title}`,
		})),
	];

	return (
		<section className="stage">
			<h2 ref={headingRef} tabIndex={-1}>
				Choose extraction
			</h2>
			<div className="action-carousel-shell">
				<button
					type="button"
					className="carousel-arrow carousel-arrow-prev"
					aria-label="Previous action"
					onClick={() => actionSwiperRef.current?.slidePrev()}
					disabled={actionSlide === 0}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M15 18l-6-6 6-6" />
					</svg>
				</button>
				<Swiper
					className="carousel action-carousel"
					slidesPerView={1}
					modules={[]}
					tabIndex={0}
					onSwiper={(swiper) => {
						actionSwiperRef.current = swiper;
					}}
					onSlideChange={(swiper) =>
						onSlideChange(swiper.activeIndex)
					}
					aria-label="Extraction action choices, use left and right arrow keys to change actions"
				>
					{AVAILABLE_ACTIONS.map((card, index) => {
						// Audio extraction requires an audio stream; frame extraction works for any inspected media.
						const available =
							card.key === 'audio'
								? media?.audioCodec != null
								: media != null;
						return (
							<SwiperSlide
								key={card.key}
								aria-hidden={
									!isActiveStage || actionSlide !== index
								}
								inert={!isActiveStage || actionSlide !== index}
							>
								<article className="action-card">
									<h3>{card.title}</h3>
									<p>
										{available
											? card.text
											: 'Not available for this media.'}
									</p>
									{available ? (
										<button
											type="button"
											className="primary"
											onClick={() =>
												onChooseAction(card.key)
											}
										>
											Select
										</button>
									) : (
										<span className="unavailable">
											Not available yet
										</span>
									)}
								</article>
							</SwiperSlide>
						);
					})}
					{PLACEHOLDER_ACTIONS.map(([title, reason], index) => {
						const slideIndex = index + AVAILABLE_ACTIONS.length;
						return (
							<SwiperSlide
								key={title}
								aria-hidden={
									!isActiveStage || actionSlide !== slideIndex
								}
								inert={
									!isActiveStage || actionSlide !== slideIndex
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
						);
					})}
				</Swiper>
				<button
					type="button"
					className="carousel-arrow carousel-arrow-next"
					aria-label="Next action"
					onClick={() => actionSwiperRef.current?.slideNext()}
					disabled={actionSlide === totalSlides - 1}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M9 18l6-6-6-6" />
					</svg>
				</button>
			</div>
			<CarouselDots
				items={actionDotItems}
				activeIndex={actionSlide}
				label="Extraction actions"
				liveText={`Action ${actionSlide + 1} of ${totalSlides}`}
				onSelect={(index) => actionSwiperRef.current?.slideTo(index)}
			/>
			<div className="stage-nav">
				<button type="button" onClick={onPreviousStage}>
					Previous
				</button>
			</div>
		</section>
	);
}
