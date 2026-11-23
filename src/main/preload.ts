import {
	contextBridge,
	ipcRenderer,
	webUtils,
	IpcRendererEvent,
} from 'electron';
import type {
	ExtractionProgress,
	ExtractionResult,
	ChooseOutputRequest,
	MediaDescriptor,
	StartExtractionRequest,
} from '../shared/media-contract';

/** Narrow renderer API exposed through Electron's isolated context bridge. */
const mediaApi = {
	/** Opens a native picker and inspects the chosen media file. */
	selectMedia(): Promise<MediaDescriptor | null> {
		return ipcRenderer.invoke('media:select');
	},
	/** Inspects a renderer-dropped file using its Electron-resolved path. */
	inspectDroppedMedia(file: File): Promise<MediaDescriptor> {
		const filePath = webUtils.getPathForFile(file);
		return ipcRenderer.invoke('media:inspect-drop', filePath);
	},
	/** Clears the current media selection in the main process. */
	clearSelection(): Promise<void> {
		return ipcRenderer.invoke('media:clear');
	},
	/** Opens the native destination picker for an extraction job. */
	chooseOutput(request: ChooseOutputRequest): Promise<string | null> {
		return ipcRenderer.invoke('media:choose-output', request);
	},
	/** Starts an audio or JPG-frame extraction job. */
	startExtraction(
		request: StartExtractionRequest,
	): Promise<ExtractionResult> {
		return ipcRenderer.invoke('media:start', request);
	},
	/** Requests cancellation of the specified active extraction. */
	abortExtraction(jobId: string): Promise<void> {
		return ipcRenderer.invoke('media:abort', jobId);
	},
	/** Opens the completed extraction output in the system file manager. */
	revealOutput(jobId: string): Promise<void> {
		return ipcRenderer.invoke('media:reveal', jobId);
	},
	/** Subscribes to extraction progress and returns an unsubscribe function. */
	onProgress(listener: (event: ExtractionProgress) => void): () => void {
		const subscription = (
			_event: IpcRendererEvent,
			value: ExtractionProgress,
		) => listener(value);
		ipcRenderer.on('media:progress', subscription);
		return () => ipcRenderer.removeListener('media:progress', subscription);
	},
};

contextBridge.exposeInMainWorld('mediaApi', mediaApi);

/** Type of the renderer API exposed by the preload context bridge. */
export type MediaApi = typeof mediaApi;
