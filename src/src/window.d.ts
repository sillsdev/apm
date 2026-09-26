// Type definitions for the API exposed in preload.js via contextBridge.exposeInMainWorld
// This file mirrors the functions added to `window.electron` in src/preload/preload.js

declare global {
  interface Window {
    electron: import('@electron-toolkit/preload').ElectronAPI;
  }
}
