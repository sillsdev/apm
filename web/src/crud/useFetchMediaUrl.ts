import { useEffect, useReducer } from 'react';
import { useGlobal, useGetGlobal } from '../context/useGlobal';
import { isElectron } from '../../api-variable';
import { remoteIdGuid, remoteId } from '../crud';
import { dataPath, PathType } from '../utils/dataPath';
import { ISharedStrings, MediaFileD } from '../model';
import { infoMsg, logError, Severity } from '../utils';
import { useFetchUrlNow } from './useFetchUrlNow';
import { findLocalMediaBlob } from './findLocalMediaBlob';
import { isLocalMediaPath } from '../utils/localMediaPath';
import { RecordKeyMap } from '@orbit/records';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../selector';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;
// See: https://www.smashingmagazine.com/2020/07/custom-react-hook-fetch-cache-data/

export enum MediaSt {
  IDLE,
  PENDING,
  FETCHED,
  ERROR,
}

export interface IMediaState {
  status: MediaSt;
  error: null | string;
  url: string; // temporary url
  id: string; // media id
  remoteId: string;
  cancelled: boolean;
}
export const mediaClean: IMediaState = {
  status: MediaSt.IDLE,
  error: null,
  url: '',
  id: '',
  remoteId: '',
  cancelled: false,
};

type Action =
  | { type: MediaSt.PENDING; payload: IMediaState } // mediaId
  | { type: MediaSt.FETCHED; payload: string } // temporary url
  | { type: MediaSt.ERROR; payload: string }
  | { type: MediaSt.IDLE; payload: undefined };

const stateReducer = (state: IMediaState, action: Action): IMediaState => {
  switch (action?.type) {
    case MediaSt.PENDING:
      return {
        ...mediaClean,
        ...action.payload,
        status: MediaSt.PENDING,
        error: '',
      };
    case MediaSt.FETCHED:
      return {
        ...state,
        status: MediaSt.FETCHED,
        url: action.payload,
      };
    case MediaSt.ERROR:
      return {
        ...state,
        status: MediaSt.ERROR,
        error: action.payload + ' ' + state.id,
      };
    case MediaSt.IDLE:
      return { ...mediaClean, status: MediaSt.IDLE };

    default:
      return state;
  }
};

export interface IFetchMediaProps {
  id: string;
}

export const useFetchMediaUrl = (reporter?: any) => {
  const [state, dispatch] = useReducer(stateReducer, mediaClean);
  const [memory] = useGlobal('memory');

  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const getGlobal = useGetGlobal();
  const fetchUrl = useFetchUrlNow();
  const safeURL = async (path: string) => {
    if (!path.startsWith('http')) {
      // recommended for tighter security but doesn't work between web and electron
      // const blob = isElectron ? await loadBlobAsync(path) : undefined;
      // if (blob) {
      //   return URL.createObjectURL(blob);
      // }
      const start = (await ipc?.isWindows()) ? 8 : 7;
      const url = new URL(`file://${path}`).toString().slice(start);
      return `file://${url}`;
    }
    return path;
  };
  const guidId = (id: string) => {
    return !isNaN(Number(id))
      ? (remoteIdGuid(
          'mediafile',
          id,
          memory?.keyMap as RecordKeyMap
        ) as string)
      : id;
  };

  const remId = (id: string) => {
    return isNaN(Number(id))
      ? (remoteId('mediafile', id, memory?.keyMap as RecordKeyMap) as string)
      : id;
  };

  useEffect(() => {
    let cancelRequest = false;
    if (!state.id) return;

    const cancelled = () => {
      if (cancelRequest) {
        // setting to idle here clears the fetched url when component refreshed
        // dispatch({ payload: undefined, type: MediaSt.IDLE });
        return true;
      }
      return false;
    };

    const fetchData = async () => {
      if (isElectron) {
        try {
          if (cancelled()) return;
          const mediarec = memory.cache.query((q) =>
            q.findRecord({
              type: 'mediafile',
              id: state.id,
            })
          ) as MediaFileD;
          if (mediarec && mediarec.attributes) {
            if (cancelled()) return;
            const local = { localname: '' };
            const audioUrl =
              mediarec.attributes.audioUrl ??
              mediarec.attributes.s3file ??
              mediarec.attributes.originalFile;
            const path = await dataPath(audioUrl, PathType.MEDIA, local);
            const foundLocal = local.localname === path;
            if (foundLocal || getGlobal('offline')) {
              if (!path.startsWith('http')) {
                if (cancelled()) return;
                dispatch({
                  payload: await safeURL(path),
                  type: MediaSt.FETCHED,
                });
                return;
              } else if (getGlobal('offline')) {
                dispatch({
                  payload: 'no offline file',
                  type: MediaSt.ERROR,
                });
                return;
              }
            }
          }
        } catch (e: any) {
          if (cancelled()) return;
          // we don't have it in our keymap?
          logError(Severity.error, reporter, infoMsg(e, ''));
          dispatch({ payload: e.message, type: MediaSt.ERROR });
        }
      } else {
        // Web local-first read (ADR 0016/0017): play the Local Media Blob when
        // this device has one; else fetchUrl downloads cloud→IDB (lazy) and we
        // play that blob, or fall through to the cloud url.
        const blob = await findLocalMediaBlob(state.id, reporter);
        if (cancelled()) return;
        if (blob) {
          dispatch({
            payload: URL.createObjectURL(blob),
            type: MediaSt.FETCHED,
          });
          return;
        }
      }
      if (cancelled()) return;
      try {
        const url = await fetchUrl({ id: state.remoteId, cancelled });
        if (url === ts.expiredToken) {
          dispatch({
            payload: ts.expiredToken,
            type: MediaSt.ERROR,
          });
          return;
        }
        if (cancelled()) return;
        if (url && isLocalMediaPath(url) && !isElectron) {
          const saved = await findLocalMediaBlob(state.id, reporter);
          if (cancelled()) return;
          if (saved) {
            dispatch({
              payload: URL.createObjectURL(saved),
              type: MediaSt.FETCHED,
            });
            return;
          }
        }
        // A local path whose blob vanished (evicted meanwhile) is not a url.
        if (!url || isLocalMediaPath(url)) {
          dispatch({ payload: 'no url', type: MediaSt.ERROR });
          return;
        }
        const path = await safeURL(url);
        if (cancelled()) return;
        dispatch({ payload: path, type: MediaSt.FETCHED });
      } catch (e: any) {
        if (cancelled()) return;
        logError(Severity.error, reporter, infoMsg(e, 'media fetch failure'));
        dispatch({ payload: e.message, type: MediaSt.ERROR });
      }
    };

    fetchData();

    return function cleanup() {
      cancelRequest = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.id]);

  // Only the web local-first branch above puts a blob: url in this state, so
  // this hook owns releasing it when the url changes or the caller unmounts.
  // Some consumers (MediaPlayer, LoadAndPlay) also revoke; a second revoke is
  // a no-op, and the others (e.g. MediaDisplay, usePassagePlayback) don't.
  useEffect(() => {
    const url = state.url;
    if (!url.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(url);
  }, [state.url]);

  const fetchMediaUrl = (props: IFetchMediaProps) => {
    let { id } = props;
    if (!id) {
      dispatch({ payload: undefined, type: MediaSt.IDLE });
      return;
    }
    const remoteId = remId(id);
    id = guidId(id);
    dispatch({
      payload: { ...mediaClean, id, remoteId },
      type: MediaSt.PENDING,
    });
  };

  return { fetchMediaUrl, safeURL, mediaState: state };
};

export default useFetchMediaUrl;
