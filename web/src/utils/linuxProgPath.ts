import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const linuxProgPath = async (): Promise<string | undefined> => {
  if (await ipc?.isWindows()) return undefined;
  if (await ipc?.exists('/snap/audio-project-manager/current/resources')) {
    return '/snap/audio-project-manager/current';
  }
  if (await ipc?.exists('/usr/lib/audio-project-manager/resources')) {
    return '/usr/lib/audio-project-manager';
  }
  if (await ipc?.exists('/opt/Audio Project Manager Desktop')) {
    return '/opt/Audio Project Manager Desktop/audio-project-manager';
  }
  return undefined;
};
