// Type definitions for the API exposed in preload.js via contextBridge.exposeInMainWorld
// This file mirrors the functions added to `window.electron` in src/preload/preload.js

declare module '@electron-toolkit/preload' {
  export interface ElectronAPI {
    appData: () => Promise<string | undefined>
    audacityOpen: () => Promise<unknown>
    availSpellLangs: () => Promise<string[]>
    customList: () => Promise<unknown>
    customRemove: (value: string) => Promise<unknown>
    getPath: (token: string) => Promise<string>
    getProfile: () => Promise<unknown>
    getSpellLangs: () => Promise<string[]>
    getToken: () => Promise<string | null>
    home: () => Promise<string>
    login: (hasUsed: boolean, email?: string) => Promise<unknown>
    logout: () => Promise<unknown>
    refreshToken: () => Promise<unknown>
    setAddToDict: (value: boolean) => Promise<unknown>
    setSpellLangs: (codes: string[]) => Promise<unknown>
    temp: () => Promise<string>
    exitApp: () => Promise<unknown>
    relaunchApp: () => Promise<unknown>
    closeApp: () => Promise<unknown>
    importOpen: () => Promise<unknown>
    execPath: () => Promise<string>
    md5File: (filePath: string) => Promise<string>
    isWindows: () => Promise<boolean>
    isMac: () => Promise<boolean>
    isProcessRunning: (name: string) => Promise<boolean>
    createFolder: (folder: string) => Promise<unknown>
    exists: (name: string) => Promise<boolean>
    stat: (folderPath: string) => Promise<string>
    read: (filePath: string, options?: unknown) => Promise<Uint8Array | string>
    write: (filePath: string, data: unknown, options?: unknown) => Promise<unknown>
    append: (filePath: string, data: unknown) => Promise<unknown>
    delete: (filePath: string) => Promise<unknown>
    copyFile: (from: string, to: string) => Promise<unknown>
    times: (filePath: string, create?: number, modify?: number) => Promise<unknown>
    readDir: (folder: string) => Promise<string[]>
    fileJson: (settings: string) => Promise<string | null>
    shell: (cmd: string) => Promise<unknown>
    openExternal: (item: string) => Promise<unknown>
    openPath: (url: string) => Promise<string>
    exec: (cmd: string, args?: string[], opts?: unknown) => Promise<unknown>
    exeCmd: (cmd: string, opts?: unknown) => Promise<unknown>
    zipOpen: (fullPath: string) => Promise<unknown>
    zipGetEntries: (zip: unknown) => Promise<unknown>
    zipReadText: (zip: unknown, name: string) => Promise<string>
    zipAddFile: (zip: unknown, name: string, data: unknown, comment?: string) => Promise<unknown>
    zipAddJson: (zip: unknown, name: string, data: unknown, comment?: string) => Promise<unknown>
    zipAddZip: (zip: unknown, name: string, addZip: unknown, comment?: string) => Promise<unknown>
    zipAddLocal: (zip: unknown, full: string, folder?: string, base?: string) => Promise<unknown>
    zipToBuffer: (zip: unknown) => Promise<Uint8Array>
    zipWrite: (zip: unknown, where: string) => Promise<unknown>
    zipExtract: (zip: unknown, folder: string, replace?: boolean) => Promise<unknown>
    zipClose: (zip: unknown) => Promise<unknown>
    zipStreamExtract: (zip: unknown, folder: string) => Promise<unknown>
    zipStreamOpen: (zip: unknown, fullPath: string) => Promise<unknown>
    zipStreamEntries: (zip: unknown) => Promise<unknown>
    zipStreamEntry: (zip: unknown, name: string) => Promise<unknown>
    zipStreamEntryData: (zip: unknown, name: string) => Promise<Uint8Array>
    zipStreamEntryText: (zip: unknown, name: string) => Promise<string>
    zipStreamClose: (zip: unknown) => Promise<unknown>
    writeBuffer: (filePath: string, blob: ArrayBuffer | Uint8Array) => Promise<unknown>
    downloadFile: (url: string, localFile: string) => Promise<unknown>
    downloadLaunch: (url: string, localFile: string) => Promise<unknown>
    downloadStat: (token: string) => Promise<unknown>
    downloadClose: (token: string) => Promise<unknown>
    normalize: (input: string, output?: string) => Promise<unknown>
  }
}

declare global {
  interface Window {
    electron: import('@electron-toolkit/preload').ElectronAPI
  }
}
