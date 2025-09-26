import request from 'request';
import fs from 'fs-extra';
/**
 * Promise based download file method
 * See: https://ourcodeworld.com/articles/read/228/how-to-download-a-webfile-with-electron-save-it-and-show-download-progress
 */

const downloadMap = new Map();
export const downloadStatus = (token: string) => {
  return JSON.stringify(downloadMap.get(token));
};
export const downloadClose = (token: string) => {
  if (downloadMap.has(token)) downloadMap.delete(token);
};

export const downloadFile = (
  url: string,
  localPath: string,
  token?: string
) => {
  return new Promise((resolve, reject) => {
    let key: string | undefined = undefined;
    let received_bytes = 0;
    let total_bytes = 0;
    let error: Error | null = null;

    const req = request({
      method: 'GET',
      uri: url,
    });

    const out = fs.createWriteStream(localPath);
    req.pipe(out);

    req.on('response', (data: { headers: { 'content-length': string } }) => {
      total_bytes = parseInt(data.headers['content-length'] || '');
      if (isNaN(total_bytes)) {
        error = new Error('Invalid content-length') as any;
      }
      if (token) {
        downloadMap.set(token, {
          received: 0,
          total: total_bytes,
          error: error,
        });
        key = token;
      }
    });

    req.on('data', (chunk: { length: number }) => {
      received_bytes += chunk.length;
      if (key) {
        const status = downloadMap.get(key);
        downloadMap.set(key, { ...status, received: received_bytes });
      }
    });

    req.on('error', (err: Error) => {
      const error = err;
      if (key) {
        const status = downloadMap.get(key);
        downloadMap.set(key, { ...status, error });
      }
    });

    out.on('finish', () => {
      let err = error;
      if (key) {
        err = downloadMap.get(key).error;
      }
      if (err) {
        fs.unlink(localPath);
        reject(err);
      } else {
        resolve(void 0);
      }
    });
    out.on('error', (err: Error) => {
      const error = err;
      if (key) {
        const status = downloadMap.get(key);
        downloadMap.set(key, { ...status, error });
      }
    });
  });
};
