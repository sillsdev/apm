import path from 'path-browserify';
import type { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

function decodeFilePathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function isFileUrl(target: string): boolean {
  return /^file:/i.test(target);
}

/** Absolute URI that is not a file: URL or a Windows drive path (C:/...). */
function isExternalUri(target: string): boolean {
  return /^[a-z][a-z0-9+.-]+:/i.test(target) && !isFileUrl(target);
}

/** Filesystem path for Electron shell.openPath (not a file:// URL). */
export function launchFilePath(target: string): string {
  if (!isFileUrl(target)) return target;
  try {
    const u = new URL(target);
    const pathname = decodeFilePathname(u.pathname);
    if (/^\/[a-zA-Z]:/.test(pathname)) return pathname.slice(1);
    if (u.hostname && u.hostname !== 'localhost') {
      return `//${u.hostname}${pathname}`;
    }
    return pathname.startsWith('/') ? pathname : `/${pathname}`;
  } catch {
    const rest = target.replace(/^file:\/\//i, '');
    if (/^\/?[a-zA-Z]:/.test(rest)) return rest.replace(/^\//, '');
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
}

export const launch = async (
  target: string,
  online: boolean
): Promise<void> => {
  if (isExternalUri(target)) {
    ipc?.openExternal(target);
    return;
  }
  const filePath = launchFilePath(target);
  // Electron shell.openPath requires a filesystem path on Windows, not file://
  if (await ipc?.isWindows()) {
    ipc?.openPath(filePath);
    return;
  }
  if (online) {
    ipc?.openExternal(isFileUrl(target) ? target : `file://${filePath}`);
    return;
  }
  if (/\.sh$/i.test(filePath)) {
    ipc?.exec('sh', [filePath], {
      env: { ...{ ...process }.env, DISPLAY: ':0' },
    });
    return;
  }
  ipc?.openPath(filePath);
};

export const launchCmd = async (target: string): Promise<void> => {
  const temp = await ipc?.temp();
  if (!temp) throw new Error('Unable to find temp directory.'); //this is app.getPath('temp')
  if (await ipc?.isWindows()) {
    const tempName = path.join(temp, 'transcriber-cmd.ps1');
    await ipc?.write(tempName, target);
    ipc?.exec(`powershell`, [tempName]).finally(async () => {
      await ipc?.delete(tempName);
    });
  } else {
    const tempName = path.join(temp, 'transcriber-cmd.sh');
    ipc?.write(tempName, target);
    ipc
      ?.exec(`sh`, [tempName], {
        env: { ...{ ...process }.env, DISPLAY: ':0' },
      })
      .finally(async () => {
        await ipc?.delete(tempName);
      });
  }
};

export default launch;
