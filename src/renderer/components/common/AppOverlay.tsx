/** Props for {@link AppOverlay}. */
export interface AppOverlayProps {
	/** Zero-based index of the active workflow stage. */
	stage: number;
	/** Ordered list of display names corresponding to each stage. */
	stageNames: readonly string[];
}

/**
 * Floating transparent overlay displaying the application title on the top-left
 * and the current workflow step badge on the top-right without covering the gradient backdrop.
 */
export function AppOverlay({ stage, stageNames }: AppOverlayProps) {
	return (
		<div className="app-overlay">
			<h1 className="app-title">Ganzo Media Converter</h1>
			<div className="step-indicator" aria-live="polite">
				Step {stage + 1} of {stageNames.length} · {stageNames[stage]}
			</div>
		</div>
	);
}
