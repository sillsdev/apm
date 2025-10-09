/// <reference types="vite/client" />
import 'redux-thunk/extend-redux';

declare module '*.svg' {
  const content: string;
  export default content;
}
declare module '@dr-kobros/react-webfont-loader';
declare module 'react-localization';
declare module '@xmldom/xmldom';

import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: unknown;
  }
}
