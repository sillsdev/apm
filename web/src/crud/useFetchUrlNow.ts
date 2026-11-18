import { useContext } from 'react';

import { isElectron } from '../../api-variable';
import { TokenContext } from '../context/TokenProvider';
import { useGetGlobal, useGlobal } from '../context/useGlobal';

import { tryDownload } from '../utils/tryDownload';
import { downloadCloudMediaToLocalBlob } from '../utils/downloadCloudMediaToLocalBlob';
import { isLocalMediaMissing } from '../utils/isLocalMediaMissing';
import { localMediaPath } from '../utils/localMediaPath';
import { isUnauthorized } from '../utils/httpError';
import { useSelector, shallowEqual } from 'react-redux';
import { ISharedStrings } from '../model';
import { sharedSelector } from '../selector';
import { errStatus } from '../store/AxiosStatus';
import { axiosGet } from '../utils/axios';
import { AxiosError } from 'axios';
import { resolveMediafileProject } from './mediafileProject';

export interface IFetchNowProps {
  id: string;
  cancelled: () => boolean;
  noDownload?: boolean;
  /**
   * Web background fill: only store the media on this device. Returns ''
   * without asking the server when it wouldn't be stored (not in the open
   * project). Desktop ignores it.
   */
  persistOnly?: boolean;
}
export const useFetchUrlNow = () => {
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? null;
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [memory] = useGlobal('memory');
  const [errorReporter] = useGlobal('errorReporter');
  const getGlobal = useGetGlobal();

  const fetchCloudUrl = async (id: string) => {
    // Safe: the fileurl endpoint's JSON:API shape; checked for attributes below.
    const response = (await axiosGet(
      `mediafiles/${id}/fileurl`,
      undefined,
      accessToken
    )) as { data?: { attributes?: { 'audio-url'?: string } } };
    return response.data?.attributes?.['audio-url'];
  };

  /** Web keeps Local Media Blobs for the open project only (ADR 0017). */
  const storableTarget = (id: string) => {
    const target = resolveMediafileProject(id, memory);
    return target?.projectId === getGlobal('project') ? target : undefined;
  };

  const fetchWebUrl = async (props: IFetchNowProps): Promise<string> => {
    const { id, cancelled, persistOnly } = props;
    const target = storableTarget(id);
    if (!target) {
      if (persistOnly) return '';
      const audioUrl = await fetchCloudUrl(id);
      return audioUrl && !cancelled() ? audioUrl : '';
    }
    // Check the device before the server: no round trip for stored media.
    if (!(await isLocalMediaMissing(target.mediafileId, errorReporter)))
      return localMediaPath(target.mediafileId);
    const audioUrl = await fetchCloudUrl(id);
    if (!audioUrl || cancelled()) return '';
    const downloaded = await downloadCloudMediaToLocalBlob({
      ...target,
      audioUrl,
      reporter: errorReporter,
      cancelled,
    });
    return downloaded.path;
  };

  const fetchDesktopUrl = async (props: IFetchNowProps): Promise<string> => {
    const audioUrl = await fetchCloudUrl(props.id);
    if (!audioUrl || props.cancelled()) return '';
    const downloaded = await tryDownload(audioUrl);
    return downloaded.ok ? downloaded.path : audioUrl;
  };

  const fetchUrlOnce = async (props: IFetchNowProps): Promise<string> => {
    if (props.noDownload) {
      const audioUrl = await fetchCloudUrl(props.id);
      return audioUrl && !props.cancelled() ? audioUrl : '';
    }
    return isElectron ? fetchDesktopUrl(props) : fetchWebUrl(props);
  };

  const fetchUrl = async (props: IFetchNowProps): Promise<string> => {
    try {
      return await fetchUrlOnce(props);
    } catch (errorResult: unknown) {
      // Safe: axios rejections carry errStatus; isUnauthorized/errStatus
      // tolerate other shapes.
      const error = errorResult as { errStatus: number } & AxiosError;
      if (isUnauthorized(error)) return ts.expiredToken;
      if (errStatus(error).errMsg.includes('transient')) {
        return await fetchUrl(props);
      } else throw error;
    }
  };

  return fetchUrl;
};
