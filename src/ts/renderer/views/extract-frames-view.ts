/*
 * Module managing the view which contains the "extract-frames-to-jpg" form.
 */

import { MediaFileData } from "../utils/types";

export type ExtractFrameToJPGSettings = {
	/**
	 * Start time to recording
	 */
	start_time?: number | null;
	/**
	 * Duration of recording
	 */
	duration_time?: number | null;
	/**
	 * Number of the frames to capture in one second.
	*/
	frame_rate?: number | null;
	/**
	 * Dimension each frame
	 */
	size?: string | null;
	/**
	 * Total frame to capture
	 */
	number?: number | null;
	/**
	 * Frame to capture every N frames
	 */
	every_n_frames?: number | null;
	/**
	 * Frame to capture every N seconds
	 */
	every_n_seconds?: number | null;
	/**
	 * Frame to capture every N percentage range
	 */
	every_n_percentage?: number | null;
	/**
	 * Maintain the original pixel video aspect ratio
	 */
	keep_pixel_aspect_ratio: boolean;
	/**
	 * Maintain the original aspect ratio
	 */
	keep_aspect_ratio: boolean;
	/**
	 * Padding color
	 */
	padding_color?: string;
	/**
	 * File name
	 */
	file_name?: string | null
}

/**
 * View configuring the extract-frames form.
 */
export default class ExtractFramesView {
	static configs: ExtractFrameToJPGSettings;

	/**
	 * Initializes the extract-frames form.
	 */
	static initialize() {
		$('#open-extract-frames').on("click", () =>
			$('#extract-frames-config-panel').slideToggle(() =>
				$('#extract-frames-slide-container').toggleClass("active")));
		$('#extract-mode-for-frames').on("click", () => {
			if ($('#extract-mode-for-frames-panel').is(":visible")) {
				return;
			}
			$('#extract-mode-for-panels>div:visible').slideDown();
			$('#extract-mode-for-frames-panel').slideUp();
		});
		$('#extract-mode-for-seconds').on("click", () => {
			if ($('#extract-mode-for-seconds-panel').is(":visible")) {
				return;
			}
			$('#extract-mode-for-panels>div:visible').slideDown();
			$('#extract-mode-for-seconds-panel').slideUp();
		});
		$('#extract-mode-for-percent').on("click", () => {
			if ($('#extract-mode-for-percent-panel').is(":visible")) {
				return;
			}
			$('#extract-mode-for-panels>div:visible').slideDown();
			$('#extract-mode-for-percent-panel').slideUp();
		});
		ExtractFramesView.reInitialize();
	}

	static reInitialize() {
		$('#extract-frames-config-panel').hide();
		$('#extract-mode-for-switch-inputs label').removeClass("active");
		$('#extract-mode-for-switch-inputs input').removeAttr("checked");
		$('#extract-mode-for-frames').attr("checked", "checked").parent().addClass("active");

		$('#extract-mode-for-panels>div').hide();
		$('#extract-mode-for-frames-panel').show();
	}

	/**
	 * Initializes form components for given media info.
	 * @param media The media info to initialize form components for.
	 */
	static configure(media: MediaFileData) {
	}

}
