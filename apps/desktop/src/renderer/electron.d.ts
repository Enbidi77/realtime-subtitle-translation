import { ElectronAPI } from '../preload/index.js';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
