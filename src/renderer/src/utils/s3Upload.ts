import Axios from 'axios';
import { API_CONFIG } from '../../api-variable';

export const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB
export const PART_SIZE = 64 * 1024 * 1024; // 64 MB
export const MAX_CONCURRENT_PARTS = 4;
export const MAX_TOTAL_PARTS = 10000; // S3 limit

export interface MultipartInitiateResponse {
  uploadId: string;
  key: string;
  filename: string;
  parts: string[];
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
}

export const singlePutUpload = (
  file: Blob,
  fileURL: string,
  contentType: string
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    const cleanup = () => {
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
      // @ts-ignore allow memory release
      xhr = null;
    };
    xhr.open('PUT', fileURL, true);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.onload = () => {
      if (xhr.status < 300) {
        cleanup();
        resolve();
      } else {
        const msg = xhr.responseText;
        cleanup();
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('Upload failed'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error('Upload aborted'));
    };
    xhr.send(file.slice());
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) =>
  status === 0 || status >= 500 || status === 429;

const isExpiredUrlError = (err: unknown) => {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    msg.includes('expired') ||
    msg.includes('signature') ||
    msg.includes('authorization') ||
    msg.includes('forbidden') ||
    msg.includes('403')
  );
};

const tryUploadPart = (
  file: Blob,
  partNumber: number,
  url: string
): Promise<UploadedPart> => {
  return new Promise<UploadedPart>((resolve, reject) => {
    const start = (partNumber - 1) * PART_SIZE;
    const end = Math.min(start + PART_SIZE, file.size);
    const slice = file.slice(start, end);

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.send(slice);

    xhr.onload = () => {
      if (xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') ?? '';
        resolve({ partNumber, etag });
      } else {
        reject(new Error(`Part ${partNumber} upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => {
      reject(new Error(`Part ${partNumber} upload failed`));
    };
  });
};

const getPartUrl = async (
  filename: string,
  partNumber: number,
  uploadId: string,
  folder: string,
  token: string | null
): Promise<string> => {
  const response = await Axios.post(
    `${API_CONFIG.host}/api/s3Files/multipart/part`,
    {
      uploadId: uploadId,
      filename: filename,
      folder: folder,
      partNumber: partNumber,
    },
    { headers: { Authorization: 'Bearer ' + token } }
  );
  return response.data.url;
};

const uploadPart = async (
  filename: string,
  uploadId: string,
  file: Blob,
  partNumber: number,
  url: string,
  folder: string,
  token: string | null,
  maxAttempts = 5
): Promise<UploadedPart> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await tryUploadPart(file, partNumber, url);
    } catch (err: any) {
      lastError = err;

      const message = err instanceof Error ? err.message : String(err);
      const statusMatch = message.match(/:\s*(\d{3})$/);
      const status = statusMatch ? Number(statusMatch[1]) : NaN;

      if (isExpiredUrlError(err)) {
        url = await getPartUrl(filename, partNumber, uploadId, folder, token);
      } else if (!Number.isNaN(status) && !isRetryableStatus(status)) {
        throw err;
      }

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const baseDelay = 250;
      const delay = baseDelay * 2 ** (attempt - 1) + Math.random() * baseDelay;
      await sleep(delay);
    }
  }

  throw lastError;
};

/**
 * Multipart S3 upload with initiate / upload-parts / complete lifecycle.
 *
 * @param file      The blob to upload
 * @param filename  Desired filename on the server
 * @param folder    S3 folder prefix (e.g. `'imports'`, `'media'`)
 * @param token     Auth bearer token
 * @returns         The S3 filename assigned by the server
 */
export const multipartS3Upload = async (
  file: Blob,
  filename: string,
  folder: string,
  token: string,
  aero: boolean = false
): Promise<string> => {
  const totalParts = Math.ceil(file.size / PART_SIZE);
  if (totalParts > MAX_TOTAL_PARTS) {
    throw new Error(
      `File exceeds maximum size of ${(MAX_TOTAL_PARTS * PART_SIZE) / (1024 * 1024 * 1024)} GB`
    );
  }
  const authHeaders = { Authorization: 'Bearer ' + token };

  const initResponse = await Axios.post(
    `${API_CONFIG.host}/api/s3Files/multipart/initiate`,
    {
      filename,
      folder,
      aero,
      contentType: (file as File).type || 'application/octet-stream',
      parts: totalParts,
    },
    { headers: authHeaders }
  );
  const {
    uploadId,
    key,
    filename: uploadedFilename,
    parts,
  } = initResponse.data as MultipartInitiateResponse;
  try {
    const uploaded: UploadedPart[] = [];
    let idx = 0;
    while (idx < parts.length) {
      const batch = parts.slice(idx, idx + MAX_CONCURRENT_PARTS);
      const results = await Promise.all(
        batch.map((p, i) =>
          uploadPart(
            uploadedFilename,
            uploadId,
            file,
            idx + 1 + i,
            p,
            folder,
            token
          )
        )
      );
      uploaded.push(...results);
      idx += MAX_CONCURRENT_PARTS;
    }

    await Axios.post(
      `${API_CONFIG.host}/api/s3Files/multipart/complete`,
      {
        uploadId,
        key,
        parts: uploaded.sort((a, b) => a.partNumber - b.partNumber),
      },
      { headers: authHeaders }
    );
    return uploadedFilename;
  } catch (err) {
    try {
      await Axios.post(
        `${API_CONFIG.host}/api/s3Files/multipart/abort`,
        { uploadId, key },
        { headers: authHeaders }
      );
    } catch {
      /* swallow abort error so it doesn't mask the original */
    }
    throw err;
  }
};
