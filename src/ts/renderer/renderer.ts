// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

import type { MediaFileData } from "./utils/types";
import type { WebApi } from "./context-bridge-api";
import initializeFileDropTarget from "./utils/drop-target";
import showToast from "./utils/toasts";
import ExtractFramesView from "./views/extract-frames-view";

declare const api: WebApi;

let conversionOutputFile: string | null = null;

api.addDomReadyListeners(() => {
	// Navigation menu.
	$("#info-menu-back-to-selection a.btn").on("click", () => api.template.goToSection(1));
	$("#info-menu-restart").on("click", () => {
		resetFileInput();
		api.template.goToSection(1);
	});

	// Initializes drop area.
	initializeFileDropTarget("section1", '#release-overlay', onFileSelected, resetFileInput);

	// Initializes select file button.
	$("#select-input-file").on("click", () => api.openFileSelector(onFileSelected));

	// Initialize web template callbacks.
	api.template.registerShowToast(showToast);
	api.template.registerConversionProgressCallback(onProgressChanged);
	api.template.registerNavigationCallback(onPageNavigation)

	onPageNavigation(0, 0, "down");

	// File input selection buttons.
	$("#select-input-file-ok").on("click", () => api.template.goToSection(2));
	$("#select-input-file-cancel").on("click", resetFileInput);

	// Convert to MP3 preset run button.
	$("#do-mp3-covert").on("click", () => api.saveFileSelector({
		name: "Mp3 file",
		extensions: ["mp3"]
	}, (targetPath) => {
		onConversionStarted();
		api.convert.extractAudioToMp3(targetPath).then((finalPath) => {
			// Conversion succeeded.
			showConversionSuccessPanel();
			conversionOutputFile = finalPath;

		}).catch(showConversionFailedPanel);
	}));

	// Extract frames to JPG form.
	ExtractFramesView.initialize();

	// Shows conversion results button.
	$("#conversion-show-output-file").on("click", () => {
		if (conversionOutputFile) {
			api.showFileInSystemExplorer(conversionOutputFile);
		}
	});

	// Abort buttons.
	$("#abort-conversion").on("click", () => $("#abort-conversion-confirm-panel").slideDown());
	$("#abort-conversion-no").on("click", () => $("#abort-conversion-confirm-panel").slideUp());
	$("#abort-conversion-yes").on("click", () => {
		$("#abort-conversion-confirm-panel").slideUp();
		api.convert.abortCurrentConversion();
	});
});

/**
 * Invoked on navigation.
 * @param from Leaving section identifier.
 * @param to Entering section identifier.
 * @param direction The direction.
 */
function onPageNavigation(from: number, to: number, direction: "up" | "down"): void {
	$("#navigation-menu li").each((index, elem) => {
		let $elem = $(elem);
		let visiblePages: string[] = $elem.data("visibleOn").toString().split(",");
		if (visiblePages.indexOf(to.toString()) != -1) {
			$elem.show();
		} else {
			$elem.hide();
		}
	});
}

/**
 * Resets the UI of the currently selected file.
 */
function resetFileInput() {
	if ($('#active-media-file').hasClass("active")) {
		$('#active-media-file').removeClass("active");
	}
	api.unselectFile();
}

/**
 * A file was selected and analyzed.
 * @param media The file successfully analyzed.
 */
function onFileSelected(media: MediaFileData, filename: string) {
	// Note: media argument has properties only, class prototype is dropped due to context bridge.
	$('#active-media-file').addClass("active");
	$('#media-info-filename').text(filename);
	$('#media-info-duration').text(media.metadata.duration.raw);
	$('#media-info-video-codec').text(media.metadata.video.codec || '');
	$('#media-info-video-container').text(media.metadata.video.container || '');
	$('#media-info-video-resolution').text(media.metadata.video.resolution.w + 'x' + media.metadata.video.resolution.h);
	$('#media-info-audio-codec').text(media.metadata.audio.codec || '');
	$('#media-info-audio-bitrate').text(media.metadata.audio.bitrate || '');

	// Prepares progress bar for future job.
	onProgressChanged(0);

	// Resets forms.
	ExtractFramesView.reInitialize();
}

/**
 * Shows conversion started panel.
 */
function onConversionStarted(): void {
	api.template.goToSection(3);
	$("#conversion-progress-panel").show();
	$("#conversion-complete-panel").hide();
	$("#abort-conversion-confirm-panel").hide();

	$("#conversion-complete-success-card").removeClass("active-result");
	$("#conversion-complete-failure-card").removeClass("active-result");
}

/**
 * A conversion completed, shows success panel.
 */
function showConversionSuccessPanel(): void {
	$("#conversion-progress-panel").hide();
	$("#conversion-complete-panel").show();

	$("#conversion-complete-success-card").show().addClass("active-result");
	$("#conversion-complete-failure-card").hide();
}

/**
 * A conversion failed, shows error panel.
 */
function showConversionFailedPanel(err:Error): void {
	console.log("Conversion failed due to following exception: ");
	console.error(err);

	$("#conversion-progress-panel").hide();
	$("#conversion-complete-panel").show();

	$("#conversion-complete-success-card").hide();
	$("#conversion-complete-failure-card").show().addClass("active-result");
}

/**
 * Updates progress bar percent value.
 * @param percent The percent value.
 */
function onProgressChanged(percent: number): void {
	// Updates the UI with given percent.
	$("#conversion-progress-bar").css("width", percent + "%");
}
