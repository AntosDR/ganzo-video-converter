import { useEffect, useRef } from 'react';

/** Props for {@link ConfirmAbortDialog}. */
export interface ConfirmAbortDialogProps {
	/** Controls whether the modal confirmation dialog is mounted. */
	open: boolean;
	/** Dismisses the dialog without cancelling the running extraction. */
	onCancel: () => void;
	/** Confirms cancellation and aborts the active extraction job. */
	onConfirmStop: () => void | Promise<void>;
}

/**
 * Accessible modal confirmation dialog shown before aborting a running extraction.
 * Captures prior focus on open, traps Tab navigation, handles Escape, and restores
 * focus to the trigger control when dismissed without stopping.
 */
export function ConfirmAbortDialog({
	open,
	onCancel,
	onConfirmStop,
}: ConfirmAbortDialogProps) {
	const dialogRef = useRef<HTMLDivElement | null>(null);
	const keepButtonRef = useRef<HTMLButtonElement | null>(null);
	const priorFocusRef = useRef<HTMLElement | null>(null);
	const skipRestoreRef = useRef(false);
	const onCancelRef = useRef(onCancel);

	useEffect(() => {
		onCancelRef.current = onCancel;
	}, [onCancel]);

	useEffect(() => {
		if (!open) return undefined;
		const dialog = dialogRef.current;
		const focusableSelector =
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

		// Remember the trigger element before shifting focus into the dialog.
		skipRestoreRef.current = false;
		priorFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		const keepFocusInDialog = (event: FocusEvent) => {
			if (dialog && !dialog.contains(event.target as Node)) {
				keepButtonRef.current?.focus();
			}
		};

		const manageDialogKeys = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onCancelRef.current();
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
			// Wrap focus inside the modal when tabbing past either boundary.
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};

		// Defer initial focus until after React finishes painting the dialog node.
		window.setTimeout(() => keepButtonRef.current?.focus(), 0);
		document.addEventListener('keydown', manageDialogKeys);
		document.addEventListener('focusin', keepFocusInDialog);

		return () => {
			document.removeEventListener('keydown', manageDialogKeys);
			document.removeEventListener('focusin', keepFocusInDialog);
			const restoreTarget = priorFocusRef.current;
			priorFocusRef.current = null;
			if (!skipRestoreRef.current && restoreTarget?.isConnected) {
				window.setTimeout(
					() => restoreTarget.focus({ preventScroll: true }),
					0,
				);
			}
		};
	}, [open]);

	if (!open) return null;

	return (
		<div
			className="dialog-backdrop"
			role="presentation"
			onClick={(event) => {
				if (event.target === event.currentTarget) onCancel();
			}}
		>
			<div
				className="dialog"
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="cancel-title"
				tabIndex={-1}
			>
				<h2 id="cancel-title">Stop extraction?</h2>
				<p>
					The in-progress extraction will stop and partial output will
					be removed.
				</p>
				<div className="button-row">
					<button
						type="button"
						ref={keepButtonRef}
						onClick={onCancel}
					>
						Keep extracting
					</button>
					<button
						type="button"
						className="danger"
						onClick={() => {
							// Focus moves to the cancelling heading instead of the removed button.
							skipRestoreRef.current = true;
							void onConfirmStop();
						}}
					>
						Stop extraction
					</button>
				</div>
			</div>
		</div>
	);
}
