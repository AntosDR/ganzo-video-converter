import type { CarouselDotItem } from '../../types/workflow';

/** Props for {@link CarouselDots}. */
export interface CarouselDotsProps {
	/** Ordered descriptors for each slide dot. */
	items: CarouselDotItem[];
	/** Zero-based index of the currently visible slide. */
	activeIndex: number;
	/** Accessible group label describing the carousel pagination. */
	label: string;
	/** Screen-reader announcement summarizing the current slide position. */
	liveText: string;
	/** Callback invoked when the user activates a specific dot. */
	onSelect: (index: number) => void;
}

/**
 * Renders animated, keyboard-accessible dot indicators kept stationary below a
 * horizontal carousel so active/inactive size transitions stay smooth across slides.
 */
export function CarouselDots({
	items,
	activeIndex,
	label,
	liveText,
	onSelect,
}: CarouselDotsProps) {
	return (
		<div className="carousel-dots" role="group" aria-label={label}>
			{/* Live text stays visually hidden while informing assistive tech of slide changes. */}
			<span className="sr-only" aria-live="polite">
				{liveText}
			</span>
			{items.map((item, index) => {
				const active = index === activeIndex;
				return (
					<button
						key={item.label}
						type="button"
						className={
							active ? 'carousel-dot active' : 'carousel-dot'
						}
						aria-label={item.label}
						aria-current={active ? 'true' : undefined}
						disabled={item.disabled}
						onClick={() => onSelect(index)}
					/>
				);
			})}
		</div>
	);
}
