import { app, systemPreferences, shell } from 'electron';

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// https://www.bigbinary.com/blog/request-camera-micophone-permission-electron
export const checkMicrophonePermission = async () => {
  const hasMicrophonePermission =
    systemPreferences.getMediaAccessStatus('microphone') === 'granted';
  if (hasMicrophonePermission) return;
  if (process.platform === 'darwin') {
    const microPhoneGranted =
      await systemPreferences.askForMediaAccess('microphone');
    if (!microPhoneGranted) {
      shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
      );
    }
  } else if (process.platform === 'win32') {
    shell.openExternal('ms-settings:privacy-microphone');
  }
};
