import { useContext } from 'react';

import { isElectron } from '../../api-variable';
import { TokenContext } from '../context/TokenProvider';
import { useGlobal } from '../context/useGlobal';

import { tryDownload } from '../utils/tryDownload';
import { downloadCloudMediaToLocalBlob } from '../utils/downloadCloudMediaToLocalBlob';
import { isUnauthorized } from '../utils/httpError';
import { useSelector, shallowEqual } from 'react-redux';
import { ISharedStrings, MediaFileD } from '../model';
import { sharedSelector } from '../selector';
import { errStatus } from '../store/AxiosStatus';
import { axiosGet } from '../utils/axios';
import { AxiosError } from 'axios';
import { remoteIdGuid } from './remoteId';
import { getMediaProjRec } from './media';
import { RecordKeyMap } from '@orbit/records';

export interface IFetchNowProps {
  id: string;
  cancelled: () => boolean;
  noDownload?: boolean;
}
export const useFetchUrlNow = () => {
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? null;
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [memory] = useGlobal('memory');

  const fetchUrl = async (props: IFetchNowProps): Promise<string> => {
    const { id, cancelled, noDownload } = props;
    try {
      const strings = (await axiosGet(
        `mediafiles/${id}/fileurl`,
        undefined,
        accessToken
      )) as { data: { attributes: { 'audio-url': string } } };
      const attr: any = strings.data.attributes;
      if (!attr || cancelled()) return '';
      const audioUrl = attr['audio-url'] as string;
      if (noDownload) return audioUrl;
      if (isElectron) {
        const downloaded = await tryDownload(audioUrl);
        return downloaded.ok ? downloaded.path : audioUrl;
      }
      const mediafileId = !isNaN(Number(id))
        ? (remoteIdGuid(
            'mediafile',
            id,
            memory?.keyMap as RecordKeyMap
          ) as string)
        : id;
      if (!mediafileId || cancelled()) return audioUrl;
      let projectId: string | undefined;
      try {
        const mediaRec = memory?.cache.query((q) =>
          q.findRecord({ type: 'mediafile', id: mediafileId })
        ) as MediaFileD;
        projectId = getMediaProjRec(mediaRec, memory)?.id;
      } catch {
        projectId = undefined;
      }
      if (!projectId) return audioUrl;
      const downloaded = await downloadCloudMediaToLocalBlob({
        mediafileId,
        projectId,
        audioUrl,
        cancelled,
      });
      return downloaded.ok ? downloaded.path : audioUrl;
    } catch (errorResult: unknown) {
      const error = errorResult as { errStatus: number } & AxiosError;
      if (isUnauthorized(error)) return ts.expiredToken;
      if (errStatus(error).errMsg.includes('transient')) {
        return await fetchUrl(props);
      } else throw error;
    }
  };

  return fetchUrl;
};
