import Axios, { AxiosResponse, HttpStatusCode } from 'axios';
import { getFingerprint } from '.';
import { API_CONFIG } from '../../api-variable';

export const axiosGetStream = async (
  api: string
): Promise<Response | undefined> => {
  api = API_CONFIG.host + '/api/' + api;
  //couldn't get axios to return a stream so use fetch
  const response = await fetch(api);
  if (response.status === HttpStatusCode.Ok) return response;
  if (response.status === HttpStatusCode.InternalServerError)
    throw new Error(response.statusText);
  return undefined;
};

export const axiosDelete = async (
  api: string,
  token?: string
): Promise<Response | undefined> => {
  api = API_CONFIG.host + '/api/' + api;
  return await Axios.delete(api, {
    headers: token
      ? {
          Authorization: 'Bearer ' + token,
        }
      : {},
  });
};
const fetchWithRetry = async (
  api: string,
  params?: URLSearchParams,
  token?: string | null,
  retries = 3,
  backoff = 300
): Promise<unknown> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await Axios.get(api, {
        params: params,
        headers: token
          ? {
              Authorization: 'Bearer ' + token,
            }
          : {},
      });
      return response.data;
    } catch (error) {
      if (i < retries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, backoff * Math.pow(2, i))
        );
      } else {
        throw error;
      }
    }
  }
};

export const axiosGet = async (
  api: string,
  params?: URLSearchParams,
  token?: string | null
): Promise<unknown> => {
  if (!api.startsWith(API_CONFIG.host)) api = API_CONFIG.host + '/api/' + api;
  return await fetchWithRetry(api, params, token);
};

export const axiosPost = async (
  api: string,
  data: unknown,
  token?: string
): Promise<unknown> => {
  const fp = await getFingerprint();
  return await Axios.post(API_CONFIG.host + '/api/' + api, data, {
    headers: token
      ? {
          Authorization: 'Bearer ' + token,
          'X-FP': fp,
        }
      : { 'X-FP': fp },
  });
};
export const axiosPatch = async (
  api: string,
  data: unknown,
  token?: string
): Promise<AxiosResponse | undefined> => {
  const fp = await getFingerprint();
  return await Axios.patch(API_CONFIG.host + '/api/' + api, data, {
    headers: token
      ? {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/vnd.api+json',
          'X-FP': fp,
        }
      : { 'Content-Type': 'application/vnd.api+json', 'X-FP': fp },
  });
};

export const axiosSendSignedUrl = async (
  api: string,
  signedUrl: string,
  targetVoice?: string,
  token?: string
): Promise<AxiosResponse | undefined> => {
  return await Axios.post(
    API_CONFIG.host + '/api/' + api,
    targetVoice
      ? {
          sourceUrl: signedUrl,
          targetUrl: targetVoice,
        }
      : {
          fileUrl: signedUrl,
        },
    {
      headers: token
        ? {
            Authorization: 'Bearer ' + token,
          }
        : {},
    }
  );
};

const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const axiosPostFile = async (
  api: string,
  file: File,
  token?: string
): Promise<AxiosResponse | undefined> => {
  const base64String = await toBase64(file);

  // Prepare the payload
  const payload = {
    fileName: file.name,
    contentType: file.type,
    data: base64String.split(',')[1], // Remove the data URL prefix
  };

  // Send the POST request with axios
  return await Axios.post(API_CONFIG.host + '/api/' + api, payload, {
    headers: token
      ? {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
  });
};
