import JSONAPISource from '@orbit/jsonapi';

export const syncRemoteAuthHeaders = (
  remote: JSONAPISource | undefined,
  accessToken: string,
  fingerprint: string
): void => {
  if (!remote?.requestProcessor) return;
  const settings = remote.requestProcessor.defaultFetchSettings ?? {};
  settings.headers = {
    ...settings.headers,
    Authorization: 'Bearer ' + accessToken,
    'X-FP': fingerprint,
  };
  remote.requestProcessor.defaultFetchSettings = settings;
};
