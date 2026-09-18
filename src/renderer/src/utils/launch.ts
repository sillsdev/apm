import path from 'path-browserify';
import type { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

/** Filesystem path for Electron shell.openPath (not a file:// URL). */
export function launchFilePath(target: string): string {
  return decodeURIComponent(target.replace(/^file:\/+/i, ''));
}

export const launch = async (
  target: string,
  online: boolean
): Promise<void> => {
  if (/^https?:\/\//i.test(target)) {
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
    ipc?.openExternal(
      target.startsWith('file:') ? target : `file://${filePath}`
    );
    return;
  }
  const cmd = /\.sh/i.test(filePath) ? '' : 'xdg-open ';
  ipc?.exeCmd(`${cmd}${filePath}`, {
    env: { ...{ ...process }.env, DISPLAY: ':0' },
  });
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
