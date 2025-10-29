import path from 'path-browserify';
import parse from 'url-parse';
import { isElectron, API_CONFIG } from '../../api-variable';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;
const { offlineData } = API_CONFIG;

export enum PathType {
  AVATARS = 'avatars',
  LOGOS = 'logos',
  FONTS = 'fonts',
  MEDIA = 'media',
  ZIP = 'zip',
  BURRITO = 'burrito',
}

export const dataPath = async (
  relPath: string = '',
  type?: PathType,
  local_out?: { localname: string }
): Promise<string> => {
  const homeDir = localStorage.getItem('home') ?? '';
  if (isElectron && offlineData) {
    let localName = '';
    switch (type) {
      case PathType.AVATARS:
      case PathType.LOGOS:
      case PathType.FONTS:
      case PathType.BURRITO:
        localName = path.join(
          homeDir,
          offlineData,
          type,
          local_out?.localname || path.basename(relPath || '')
        );
        break;
      case PathType.MEDIA: {
        const parsedUrl = parse(relPath);
        const fileName = relPath?.startsWith('http')
          ? parsedUrl.pathname
            ? parsedUrl.pathname.split('?')[0]?.split('/').pop() || ''
            : ''
          : path.basename(relPath);
        localName = path.join(
          homeDir,
          offlineData,
          type,
          decodeURIComponent(fileName)
        );
        break;
      }
      default:
      case PathType.ZIP:
        localName = path.join(
          homeDir,
          offlineData,
          local_out?.localname || path.basename(relPath || '')
        );
        break;
    }
    if (local_out) local_out.localname = localName;
    if (await ipc?.exists(localName)) return localName;
    //s3 paths look like https://sil-transcriber-userfiles-dev.s3.amazonaws.com/noorg/B14___01_2Thess______ENGESVN2DA.mp3?AWSAccessKeyId=xxx
    if (type === PathType.MEDIA && relPath?.includes('s3.amazonaws')) {
      // This logic handles names with slashes. Sholdn't nappen again
      const fileName =
        parse(relPath).pathname?.split('?')[0]?.split('/').pop() || '';
      localName = path.join(
        homeDir,
        offlineData,
        type,
        decodeURIComponent(fileName)
      );
      if (local_out) local_out.localname = localName;
      if (await ipc?.exists(localName)) return localName;
    }
  }
  return relPath?.startsWith('http')
    ? relPath
    : offlineData
      ? path.join(homeDir, offlineData, relPath || '')
      : '';
};

export default dataPath;
