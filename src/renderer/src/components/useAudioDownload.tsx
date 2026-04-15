import React, { useCallback, useEffect, useState } from 'react';
import { useGlobal } from '../context/useGlobal';
import { ISharedStrings, MediaFileD } from '../model';
import {
  remoteIdGuid,
  useFetchMediaUrl,
  MediaSt,
  mediaFileName,
} from '../crud';
import { loadBlob, removeExtension } from '../utils';
import { useSnackBar } from '../hoc/SnackBar';
import { useSelector } from 'react-redux';
import { sharedSelector } from '../selector';
import { RecordKeyMap } from '@orbit/records';

export interface AudioDownloadApi {
  startDownload: (event?: React.MouseEvent<HTMLElement>) => void;
  isDisabled: boolean;
  hiddenAnchor: React.ReactNode;
}

export function useAudioDownload(mediaId: string): AudioDownloadApi {
  const ts: ISharedStrings = useSelector(sharedSelector);
  const [memory] = useGlobal('memory');
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const audAnchor = React.useRef<HTMLAnchorElement>(null);
  const [audName, setAudName] = useState('');
  const [blobUrl, setBlobUrl] = useState('');
  const { showMessage } = useSnackBar();

  const isDisabled =
    (mediaId || '') === '' || mediaId === mediaState.remoteId || audName !== '';

  const startDownload = useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      event?.stopPropagation();
      if (
        (mediaId || '') === '' ||
        mediaId === mediaState.remoteId ||
        audName !== ''
      ) {
        return;
      }
      const id =
        remoteIdGuid('mediafile', mediaId, memory?.keyMap as RecordKeyMap) ||
        mediaId;
      const mediaRec = memory.cache.query((q) =>
        q.findRecord({ type: 'mediafile', id })
      ) as MediaFileD;
      const fullName = mediaFileName(mediaRec) || `media-${id}`;
      const { name, ext } = removeExtension(fullName);
      const version = mediaRec?.attributes?.versionNumber || '1';
      setAudName(`${name}-ver${version}.${ext}`);
      if (id !== mediaState.id) {
        fetchMediaUrl({ id });
      }
    },
    [
      audName,
      fetchMediaUrl,
      mediaId,
      mediaState.id,
      mediaState.remoteId,
      memory,
    ]
  );

  useEffect(() => {
    setBlobUrl('');
    if (mediaState.status === MediaSt.FETCHED)
      loadBlob(mediaState.url, (url, b) => {
        //not sure what this intermediary file is, but causes console errors
        if (b && b?.type !== 'text/html') setBlobUrl(URL.createObjectURL(b));
      });
    if (mediaState?.error?.startsWith('no offline file'))
      showMessage(ts.fileNotFound);
    else if (mediaState?.error) showMessage(mediaState.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState]);

  useEffect(() => {
    if (audName !== '' && blobUrl !== '') {
      if (audAnchor?.current) {
        audAnchor.current.click();
        setAudName('');
        setBlobUrl('');
      }
      fetchMediaUrl({ id: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobUrl, audName]);

  const hiddenAnchor = blobUrl ? (
    <a
      ref={audAnchor}
      href={blobUrl}
      download={audName}
      target="_blank"
      rel="noopener noreferrer"
    />
  ) : null;

  return { startDownload, isDisabled, hiddenAnchor };
}
