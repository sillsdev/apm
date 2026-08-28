import { useEffect, useReducer, useRef, useState } from 'react';
import useFetchMediaUrl, { IMediaState, mediaClean } from './useFetchMediaUrl';
import { useGlobal } from '../context/useGlobal';
import { loadBlob } from '../utils/loadBlob';

export enum BlobStatus {
  'IDLE',
  'PENDING',
  'RESET', // 403 when getting blob
  'FETCHED',
  'ERROR',
}
export interface IBlobState extends IMediaState {
  blob: Blob;
  blobStat: BlobStatus;
}

export const blobClean = {
  ...mediaClean,
  blob: new Blob(),
  blobStat: BlobStatus.IDLE,
};

interface IFetched {
  url: string;
  blob: Blob;
}

type Action =
  | { type: BlobStatus.PENDING; payload: IMediaState } // mediaId
  | { type: BlobStatus.FETCHED; payload: IFetched }
  | { type: BlobStatus.RESET; payload: IMediaState }
  | { type: BlobStatus.ERROR; payload: string }
  | { type: BlobStatus.IDLE; payload: undefined };

const stateReducer = (state: IBlobState, action: Action): IBlobState => {
  switch (action?.type) {
    case BlobStatus.PENDING:
      return {
        ...blobClean,
        ...action.payload,
        blobStat: BlobStatus.PENDING,
        error: '',
      };
    case BlobStatus.RESET:
      return {
        ...blobClean,
        ...action.payload,
        blobStat: BlobStatus.RESET,
      };
    case BlobStatus.FETCHED:
      return {
        ...state,
        blobStat: BlobStatus.FETCHED,
        url: action.payload.url,
        blob: action.payload.blob,
      };
    case BlobStatus.ERROR:
      return {
        ...state,
        blobStat: BlobStatus.ERROR,
        error: action.payload + ' ' + state.id,
      };
    case BlobStatus.IDLE:
      return { ...blobClean, blobStat: BlobStatus.IDLE };

    default:
      return state;
  }
};

/**
 * A 403 on the signed URL means it expired: we drop the URL and re-request a
 * fresh one (RESET -> PENDING). But a URL that keeps coming back 403 - a genuine
 * permission problem, not expiry - would loop that forever, re-issuing a
 * signed-URL request and a blob GET every turn (part of the TT-7621 network
 * storm). Cap the re-requests, then surface the error.
 */
const MAX_URL_RESETS = 3;

export const useFetchMediaBlob = () => {
  const [reporter] = useGlobal('errorReporter');
  const [mediaId, setMediaId] = useState('');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const [state, dispatch] = useReducer(stateReducer, blobClean);
  const resetTriesRef = useRef(0);

  const fetchBlob = (url: string) => {
    setMediaId(url);
  };

  type retValue = [IBlobState, typeof fetchBlob];

  useEffect(() => {
    resetTriesRef.current = 0;
    if (!mediaId) {
      // Nothing requested yet - stay IDLE rather than PENDING, so a consumer
      // that reads its loading state from blobStat === PENDING does not show a
      // spurious spinner before the first fetchBlob (Copilot).
      dispatch({ type: BlobStatus.IDLE, payload: undefined });
      return;
    }
    fetchMediaUrl({ id: mediaId });
    dispatch({
      type: BlobStatus.PENDING,
      payload: { ...mediaState, id: mediaId },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  useEffect(() => {
    if (state.blobStat === BlobStatus.PENDING && mediaState.url) {
      try {
        loadBlob(mediaState.url, (urlOrError, blob) => {
          if (!blob) {
            if (urlOrError.includes('403')) {
              if (resetTriesRef.current >= MAX_URL_RESETS) {
                // Not expiry - the object keeps 403ing. Stop re-requesting.
                dispatch({ type: BlobStatus.ERROR, payload: urlOrError });
                return;
              }
              resetTriesRef.current += 1;
              fetchMediaUrl({ id: '' });
              dispatch({ type: BlobStatus.RESET, payload: mediaState });
            } else {
              dispatch({ type: BlobStatus.ERROR, payload: urlOrError });
            }
            return;
          }
          // we have a blob blob
          if (blob.type !== 'text/html' && blob.type !== 'application/xml') {
            resetTriesRef.current = 0;
            const url = urlOrError;
            dispatch({ type: BlobStatus.FETCHED, payload: { url, blob } });
          } else {
            // An HTML/XML body is an error page (S3/CDN), not audio. Terminate
            // instead of leaving blobStat PENDING forever, which stranded the
            // reference player on "Loading..." (TT-7621). Name the unexpected
            // content type so the logged error is actionable (Copilot).
            dispatch({
              type: BlobStatus.ERROR,
              payload: `unexpected content type ${blob.type}: ${urlOrError}`,
            });
          }
        });
      } catch (errorResult: unknown) {
        const error = errorResult as Error;
        dispatch({ type: BlobStatus.ERROR, payload: error.message });
      }
    } else if (state.blobStat === BlobStatus.RESET) {
      fetchMediaUrl({ id: mediaId });
      dispatch({
        type: BlobStatus.PENDING,
        payload: { ...mediaState, id: mediaId },
      });
    } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState.url]);

  return [state, fetchBlob] as retValue;
};
