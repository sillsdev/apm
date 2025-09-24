import { join } from 'path-browserify';
// @ts-ignore we need this for electron which has this dependency
import { Stats } from 'fs-extra';
import { LocalKey, createFolder } from '.';
import { DateTime } from 'luxon';
import Bugsnag from '@bugsnag/js';
import { AxiosError } from 'axios';
import bugsnagClient from 'auth/bugsnagClient';
const ipc = window?.electron;

export enum Severity {
  info = 0,
  error = 1,
  retry = 2,
}

export function logError(
  level: Severity,
  reporter: typeof bugsnagClient | string,
  error: Error | string
): void {
  const connected = localStorage.getItem(LocalKey.connected);
  if (connected && connected !== 'true') {
    logMessage(
      localStorage.getItem(LocalKey.errorLog) ?? LocalKey.errorLog,
      level,
      error
    );
  } else if (typeof reporter === 'string') {
    logMessage(reporter, level, error);
  } else if (reporter) {
    if (level === Severity.error) {
      if (reporter)
        Bugsnag.notify(typeof error === 'string' ? new Error(error) : error);
    } else if (level === Severity.info || level === Severity.retry) {
      if (typeof error === 'string') {
        if (error !== '' && Bugsnag.leaveBreadcrumb) {
          Bugsnag.leaveBreadcrumb(error);
        }
      } else {
        if (reporter)
          Bugsnag.leaveBreadcrumb(error.message, { name: error.name });
      }
    }
  }
  if (typeof error !== 'string' || error !== '') {
    console.log(level ? 'ERROR:' : 'INFO:', error);
  }
}

// Format date (local) as YYYY-MM-DD using luxon
const dayFormat = (s?: Date): string =>
  (s ? DateTime.fromJSDate(s) : DateTime.now()).toFormat('yyyy-LL-dd');
const isToday = (s: Date): boolean => dayFormat(s) === dayFormat();

const LogFolder = (): string =>
  join(localStorage.getItem('home') || '', '.transcriber-logs');

const logFileHeader = (logFullName: string): void => {
  // Add file header
  console.log(`creating new file ${logFullName}`);
  const stamp = DateTime.now().setLocale('en').toFormat('MM/dd/yyyy h:mm a ZZ');
  ipc?.write(logFullName, `Log for ${stamp}\n`);
};

const levelText = (level: Severity): string =>
  level === Severity.info
    ? 'INFO'
    : level === Severity.error
      ? 'ERROR'
      : 'RETRY';

const axiosErrorText = (err: AxiosError): string => {
  let msg = err.request?.responseURL + '\n' + JSON.stringify(err) + '\n';
  const errMsg = (err.response?.data as { errors: string[] })?.errors;
  if (Array.isArray(errMsg)) {
    errMsg.forEach((e) => (msg += JSON.stringify(e) + '\n'));
  }
  return msg;
};

function stringify(obj: unknown): string {
  let cache: unknown[] | null = [];
  const str = JSON.stringify(obj, function (key, value) {
    if (typeof value === 'object' && value !== null) {
      if (cache?.indexOf(value) !== -1) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our collection
      cache.push(value);
    }
    return value;
  });
  cache = null; // reset the cache
  return str;
}
const msgText = (message: Error | string | AxiosError): string =>
  typeof message === 'string'
    ? message
    : message instanceof AxiosError
      ? axiosErrorText(message as AxiosError)
      : stringify(message) + '\n';

const logMessage = async (
  logFullName: string,
  level: Severity,
  msg: Error | string | AxiosError
): Promise<void> => {
  // Add file header
  // console.log(`creating new file ${logFullName}`);
  await ipc?.append(
    logFullName,
    `${new Date().toISOString()} ${levelText(level)}: ${msgText(msg)}\n`
  );
};

interface IStatErr {
  errno: number;
  code: string;
  syscall: string;
  path: string;
}

export async function logFile(): Promise<string> {
  const logFolder = LogFolder();
  const loc = Intl.NumberFormat().resolvedOptions().locale;
  console.log(`logfile locale=${loc}`);
  const logName = `log-${DateTime.now().setLocale(loc).toFormat('dd')}.log`;
  const logFullName = join(logFolder, logName);
  const stats = JSON.parse(await ipc?.stat(logFullName)) as Stats & IStatErr;
  if (stats?.code) {
    const err = stats;
    if (err?.code === 'ENOENT') {
      await createFolder(logFolder);
      logFileHeader(logFullName);
    } else if (err) {
      console.log(JSON.stringify(err));
    }
  } else {
    if (!isToday(stats.ctime)) {
      logFileHeader(logFullName);
    } else {
      console.log(`using existing file ${logFullName}`);
    }
  }
  return logFullName;
}

export default logError;
