// Type definitions for the API exposed in preload.js via contextBridge.exposeInMainWorld
// This file mirrors the functions added to `window.electron` in src/preload/preload.js
import { User } from '@auth0/auth0-react';

declare module '@electron-toolkit/preload' {
  export interface ElectronAPI {
    appData: () => Promise<string | undefined>;
    audacityOpen: () => Promise<string[]>;
    availSpellLangs: () => Promise<string[]>;
    customList: () => Promise<unknown>;
    customRemove: (value: string) => Promise<unknown>;
    getPath: (token: string) => Promise<string>;
    getProfile: () => Promise<User | undefined>;
    getSpellLangs: () => Promise<string[]>;
    getToken: () => Promise<string | null>;
    home: () => Promise<string>;
    login: (hasUsed: boolean, email?: string) => Promise<unknown>;
    logout: () => Promise<unknown>;
    refreshToken: () => Promise<unknown>;
    setAddToDict: (value: boolean) => Promise<unknown>;
    setSpellLangs: (codes: string[]) => Promise<unknown>;
    temp: () => Promise<string>;
    exitApp: () => Promise<unknown>;
    relaunchApp: () => Promise<unknown>;
    closeApp: () => Promise<unknown>;
    importOpen: () => Promise<string[] | undefined>;
    execPath: () => Promise<string>;
    md5File: (filePath: string) => Promise<string>;
    isWindows: () => Promise<boolean>;
    isMac: () => Promise<boolean>;
    isProcessRunning: (name: string) => Promise<boolean>;
    createFolder: (folder: string) => Promise<unknown>;
    exists: (name: string) => Promise<boolean>;
    stat: (folderPath: string) => Promise<string>;
    read: (filePath: string, options?: unknown) => Promise<Uint8Array | string>;
    write: (
      filePath: string,
      data: unknown,
      options?: unknown
    ) => Promise<unknown>;
    append: (filePath: string, data: unknown) => Promise<unknown>;
    delete: (filePath: string) => Promise<unknown>;
    copyFile: (from: string, to: string) => Promise<unknown>;
    times: (
      filePath: string,
      create?: number,
      modify?: number
    ) => Promise<unknown>;
    readDir: (folder: string) => Promise<string[]>;
    fileJson: (settings: string) => Promise<string | null>;
    shell: (cmd: string) => Promise<unknown>;
    openExternal: (item: string) => Promise<unknown>;
    openPath: (url: string) => Promise<string>;
    exec: (cmd: string, args?: string[], opts?: unknown) => Promise<unknown>;
    exeCmd: (cmd: string, opts?: unknown) => Promise<unknown>;
    zipOpen: (fullPath?: string) => Promise<string>;
    zipGetEntries: (zip: string) => Promise<string>;
    zipReadText: (zip: string, name: string) => Promise<string>;
    zipAddFile: (
      zip: string,
      name: string,
      data: string,
      comment?: string
    ) => Promise<boolean>;
    zipAddJson: (
      zip: string,
      name: string,
      data: string,
      comment?: string
    ) => Promise<boolean>;
    zipAddZip: (
      zip: string,
      name: string,
      addZip: string,
      comment?: string
    ) => Promise<boolean>;
    zipAddLocal: (
      zip: string,
      full: string,
      folder?: string,
      base?: string
    ) => Promise<boolean>;
    zipToBuffer: (zip: string) => Promise<Uint8Array>;
    zipWrite: (zip: string, where: string) => Promise<boolean>;
    zipExtract: (
      zip: string,
      folder: string,
      replace?: boolean
    ) => Promise<boolean>;
    zipClose: (zip: string) => Promise<void>;
    zipStreamExtract: (zip: string, folder: string) => Promise<boolean>;
    zipStreamOpen: (fullPath: string) => Promise<string>;
    zipStreamEntries: (zip: string) => Promise<string>;
    zipStreamEntry: (zip: string, name: string) => Promise<string>;
    zipStreamEntryData: (zip: string, name: string) => Promise<Uint8Array>;
    zipStreamEntryText: (zip: string, name: string) => Promise<string>;
    zipStreamClose: (zip: string) => Promise<void>;
    writeBuffer: (
      filePath: string,
      blob: ArrayBuffer | Uint8Array
    ) => Promise<boolean>;
    downloadFile: (url: string, localFile: string) => Promise<string>;
    downloadLaunch: (url: string, localFile: string) => Promise<string>;
    downloadStat: (token: string) => Promise<string>;
    downloadClose: (token: string) => Promise<void>;
    normalize: (input: string, output?: string) => Promise<unknown>;
  }
}

declare global {
  interface Window {
    electron: import('@electron-toolkit/preload').ElectronAPI;
  }
}
