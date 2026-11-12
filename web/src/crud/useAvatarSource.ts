import { useEffect, useState } from 'react';
import path from 'path-browserify';
import { User } from '../model';
import { dataPath, PathType } from '../utils/dataPath';
import { remoteId } from './remoteId';
import { isElectron } from '../../api-variable';
import { RecordIdentity, RecordKeyMap } from '@orbit/records';
import { useGlobal } from '../context/useGlobal';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const useAvatarSource = (name: string, rec: RecordIdentity) => {
  const [source, setSource] = useState('');
  const [memory] = useGlobal('memory');

  useEffect(() => {
    (async () => {
      const url = (rec as User)?.attributes?.avatarUrl;
      let src = await dataPath(url || name, PathType.AVATARS, {
        localname:
          remoteId(rec?.type, rec.id, memory?.keyMap as RecordKeyMap) +
          name +
          '.png',
      });
      if (src && isElectron && !src.startsWith('http')) {
        // exists() is true for the offline data directory; only files are avatars
        if (path.extname(src) && (await ipc?.exists(src))) {
          const start = (await ipc?.isWindows()) ? 8 : 7;
          src = `file://${new URL(`file://${src}`).toString().slice(start)}`;
        } else src = '';
      }
      setSource(src);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, rec]);

  return source;
};
