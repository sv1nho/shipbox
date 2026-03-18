import type { ElectronAPI } from "./index.js";

export {};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
