import { useContext } from 'react';

import { isElectron } from '../../api-variable';
import { TokenContext } from '../context/TokenProvider';

import { tryDownload } from '../utils/tryDownload';
import { useSelector, shallowEqual } from 'react-redux';
import { ISharedStrings } from '../model';
import { sharedSelector } from '../selector';
import { errStatus } from '../store/AxiosStatus';
import { axiosGet } from '../utils/axios';
import { AxiosError } from 'axios';

export interface IFetchNowProps {
  id: string;
  cancelled: () => boolean;
  noDownload?: boolean;
}
export const useFetchUrlNow = () => {
  const tokenContext = useContext(TokenContext);
  const accessToken = tokenContext?.state?.accessToken;
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

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
      if (isElectron && !noDownload) {
        return await tryDownload(audioUrl);
      } else return audioUrl;
    } catch (errorResult: unknown) {
      const error = errorResult as { errStatus: number } & AxiosError;
      if (error.errStatus === 401) return ts.expiredToken;
      const err = error as AxiosError;
      if (err.status === 401) return ts.expiredToken;
      if (errStatus(error).errMsg.includes('transient')) {
        return await fetchUrl(props);
      } else throw error;
    }
  };

  return fetchUrl;
};
