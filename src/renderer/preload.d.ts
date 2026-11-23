import type { MediaApi } from '../main/preload';

declare global {
  interface Window {
    mediaApi: MediaApi;
  }
}

export {};
