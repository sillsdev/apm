import * as fs from 'fs-extra';
import { net } from 'electron';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
/**
 * Promise based download file method.
 * Uses Electron net.fetch (Chromium TLS/proxy) so corporate SSL inspection
 * and OS trust stores work — Node https hits UNABLE_TO_VERIFY_LEAF_SIGNATURE.
 * Pass the original URL string so S3 pre-signed query strings stay exact.
 */

const downloadMap = new Map();
export const downloadStatus = (token: string) => {
  return JSON.stringify(downloadMap.get(token));
};
export const downloadClose = (token: string) => {
  if (downloadMap.has(token)) downloadMap.delete(token);
};

export const downloadFile = async (
  url: string,
  localPath: string,
  token?: string
): Promise<void> => {
  new URL(url); // validate early

  const response = await net.fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': 'Audio-Project-Manager' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('HTTP response has no body');
  }

  const total_bytes = parseInt(
    response.headers.get('content-length') || '0',
    10
  );
  if (token) {
    downloadMap.set(token, {
      received: 0,
      total: total_bytes,
      error: null,
    });
  }

  let received_bytes = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      received_bytes += chunk.length;
      if (token) {
        const status = downloadMap.get(token);
        downloadMap.set(
          token,
          status
            ? { ...status, received: received_bytes }
            : {
                received: received_bytes,
                total: total_bytes,
                error: null,
              }
        );
      }
      cb(null, chunk);
    },
  });

  try {
    const nodeReadable = Readable.fromWeb(
      response.body as import('stream/web').ReadableStream
    );
    await pipeline(nodeReadable, counter, fs.createWriteStream(localPath));
  } catch (err) {
    if (token) {
      const status = downloadMap.get(token);
      downloadMap.set(
        token,
        status ? { ...status, error: err } : { error: err }
      );
    }
    // Unlink before rethrow so renderer exists() cannot race a leftover file.
    await fs.unlink(localPath).catch(() => undefined);
    throw err;
  }
};
