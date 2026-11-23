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

const mediaApi = {
  selectMedia(): Promise<MediaDescriptor | null> {
    return ipcRenderer.invoke('media:select');
  },
  inspectDroppedMedia(file: File): Promise<MediaDescriptor> {
    const filePath = webUtils.getPathForFile(file);
    return ipcRenderer.invoke('media:inspect-drop', filePath);
  },
  clearSelection(): Promise<void> {
    return ipcRenderer.invoke('media:clear');
  },
  chooseOutput(request: ChooseOutputRequest): Promise<string | null> {
    return ipcRenderer.invoke('media:choose-output', request);
  },
  startExtraction(request: StartExtractionRequest): Promise<ExtractionResult> {
    return ipcRenderer.invoke('media:start', request);
  },
  abortExtraction(jobId: string): Promise<void> {
    return ipcRenderer.invoke('media:abort', jobId);
  },
  revealOutput(jobId: string): Promise<void> {
    return ipcRenderer.invoke('media:reveal', jobId);
  },
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

export type MediaApi = typeof mediaApi;
