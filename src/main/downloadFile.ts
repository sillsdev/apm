import fs from 'fs-extra';
import https from 'https';
import http from 'http';
import { URL } from 'url';
/**
 * Promise based download file method
 * Uses native Node.js http/https modules to preserve S3 pre-signed URLs exactly as-is
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

    try {
      // Parse URL to get components, but use the original URL string for the request
      // to preserve the exact path and query string (important for S3 signatures)
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      // Use the original URL string to preserve exact path encoding
      // This is critical for S3 pre-signed URLs where the signature depends on the exact URL
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search, // Preserve path and query exactly
        method: 'GET',
        headers: {
          'User-Agent': 'Audio-Project-Manager',
        },
      };

      const out = fs.createWriteStream(localPath);
      const req = client.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          error = new Error(
            `HTTP ${res.statusCode}: ${res.statusMessage}`
          ) as any;
          res.resume(); // Consume response to free up memory
          out.destroy();
          if (key) {
            const status = downloadMap.get(key);
            downloadMap.set(key, status? { ...status, error }: { error })
          }
          reject(error);
          return;
        }

        total_bytes = parseInt(res.headers['content-length'] || '0', 10);
        if (token) {
          downloadMap.set(token, {
            received: 0,
            total: total_bytes,
            error: error,
          });
          key = token;
        }

        res.on('data', (chunk: Buffer) => {
          received_bytes += chunk.length;
          if (key) {
            const status = downloadMap.get(key);
            downloadMap.set(key, status
              ? { ...status, received: received_bytes }
              :  { received: received_bytes });
          }
        });

        res.on('end', () => {
          out.end();
        });

        res.pipe(out);
      });

      req.on('error', (err: Error) => {
        error = err;
        out.destroy();
        if (key) {
          const status = downloadMap.get(key);
          downloadMap.set(key, status? { ...status, error }: { error });
        }
        reject(error);
      });

      out.on('finish', () => {
        let err = error;
        if (key) {
          err = downloadMap.get(key)?.error;
        }
        if (err) {
          fs.unlink(localPath).catch(() => {
            // Ignore unlink errors
          });
          reject(err);
        } else {
          resolve(void 0);
        }
      });

      out.on('error', (err: Error) => {
        error = err;
        req.destroy();
        if (key) {
          const status = downloadMap.get(key);
          downloadMap.set(key, status? { ...status, error }: { error });
        }
        reject(error);
      });

      req.end();
    } catch (err) {
      const error = err as Error;
      reject(error);
    }
  });
};
