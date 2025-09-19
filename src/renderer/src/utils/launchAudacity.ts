import { IExeca } from '../model';
import { getAudacityExe, logError, Severity, infoMsg, execFolder } from '.';
import path from 'path-browserify';
import process from 'process';
import bugsnagClient from 'auth/bugsnagClient';
const ipc = window?.electron;

export const launchAudacity = async (
  proj: string,
  reporter: string | typeof bugsnagClient
): Promise<void> => {
  const isMac = await ipc?.isMac();
  const audacityExe = await getAudacityExe();
  const args = isMac
    ? ['/Applications/Audacity.app', `"${proj}"`]
    : [`"${proj}"`];
  ipc
    ?.exec(isMac ? 'open' : `"${audacityExe}"`, args, {
      shell: true,
      detached: true,
      cwd: path.join(await execFolder(), 'resources'),
      env: { ...{ ...process }.env },
    })
    .then((resResult: unknown) => {
      const res = resResult as IExeca | null | undefined;
      if (typeof res?.stdout === 'string' && res.stdout.trim().length > 0) {
        const msg = `Launch Audacity Results:\n${res.stdout}`;
        logError(Severity.info, reporter, msg);
      }
    })
    .catch((errResult: unknown) => {
      const err = errResult as IExeca | null | undefined;
      const launchErr = 'Launch Audacity Error';
      if (typeof err?.stdout === 'string' && err.stdout.trim().length > 0) {
        const msg = `${launchErr}\n${err.stdout}`;
        logError(
          Severity.error,
          reporter,
          infoMsg(err.error ?? (errResult as Error), msg)
        );
      } else {
        logError(
          Severity.error,
          reporter,
          infoMsg(err?.error ?? (errResult as Error), launchErr)
        );
      }
    });
};
