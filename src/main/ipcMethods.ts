import { app, ipcMain, session, dialog, BrowserWindow, shell } from 'electron';
import { createWindow } from './index';
import { createAuthWindow, createLogoutWindow } from './auth-process.js';
import { refreshTokens, getProfile, getAccessToken } from './auth-service.js';
import * as fs from 'fs-extra';
import StreamZip from 'node-stream-zip';
import AdmZip from 'adm-zip';
import { downloadFile, downloadStatus, downloadClose } from './downloadFile.js';
import { generateUUID } from './generateUUID.js';
import convert from 'xml-js';
import { exec } from 'child_process';
// execa is an ESM module so we included source to make it work
import { execa } from 'execa';
import md5File from 'md5-file';

export function ipcMethods(): void {
  ipcMain.handle('availSpellLangs', async () => {
    return session.defaultSession.availableSpellCheckerLanguages;
  });

  ipcMain.handle('getSpellLangs', async () => {
    return session.defaultSession.getSpellCheckerLanguages();
  });

  ipcMain.handle('setSpellLangs', async (_event, langs) => {
    session.defaultSession.setSpellCheckerLanguages(langs);
  });

  ipcMain.handle('customList', async () => {
    return session.defaultSession.listWordsInSpellCheckerDictionary();
  });

  ipcMain.handle('customRemove', async (_event, word) => {
    session.defaultSession.removeWordFromSpellCheckerDictionary(word);
  });

  ipcMain.handle('customAdd', async (_event, word) => {
    session.defaultSession.addWordToSpellCheckerDictionary(word);
  });

  ipcMain.handle('md5File', async (_event, file) => {
    return md5File.sync(file);
  });

  ipcMain.handle('isWindows', async () => {
    return process.platform === 'win32';
  });

  ipcMain.handle('isMac', async () => {
    return process.platform === 'darwin';
  });

  ipcMain.handle('isProcessRunning', async (_event, name) => {
    const platformMap = new Map([
      ['win32', 'tasklist'],
      ['darwin', `ps -ax | grep ${name}`],
      ['linux', `ps -A`],
    ]);
    const cmd = platformMap.get(process.platform);
    return new Promise((resolve, reject) => {
      if (!cmd) reject(new Error('Command not found'));
      exec(cmd as string, (err, stdout) => {
        if (err) reject(err);

        resolve(stdout.toLowerCase().indexOf(name.toLowerCase()) > -1);
      });
    });
  });

  ipcMain.handle('log', async (_event, ...args) => {
    console.log(...args);
  });

  ipcMain.handle('temp', async () => {
    return app.getPath('temp').replace(/\\/g, '/');
  });

  ipcMain.handle('execPath', async () => {
    return (process as any).helperExecPath.replace(/\\/g, '/');
  });

  ipcMain.handle('home', async () => {
    return app.getPath('home').replace(/\\/g, '/');
  });

  ipcMain.handle('getPath', async (_event, name) => {
    return app.getPath(name).replace(/\\/g, '/');
  });

  ipcMain.handle('exitApp', async () => {
    app.exit();
  });

  ipcMain.handle('relaunchApp', async () => {
    app.relaunch();
  });

  ipcMain.handle('closeApp', async () => {
    for (const w of BrowserWindow.getAllWindows()) {
      w.close();
    }
  });

  ipcMain.handle('appData', async () => {
    return process.env.AppData;
  });

  ipcMain.handle('createFolder', async (_event, folder) => {
    try {
      fs.statSync(folder);
    } catch (errResult) {
      const err = errResult as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') fs.mkdirSync(folder, { recursive: true });
    }
  });

  ipcMain.handle('exists', async (_event, name) => {
    return fs.existsSync(name);
  });

  ipcMain.handle('stat', async (_event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      return JSON.stringify(stats);
    } catch (err) {
      return JSON.stringify(err);
    }
  });

  ipcMain.handle('read', async (_event, filePath, options) => {
    return fs.readFileSync(filePath, options);
  });

  ipcMain.handle('write', async (_event, filePath, data, options) => {
    return fs.writeFileSync(filePath, data, { encoding: 'utf-8', ...options });
  });

  ipcMain.handle('append', async (_event, filePath, data) => {
    return fs.open(filePath, 'a', (err, fd) => {
      if (err) throw err;
      fs.writeFile(fd, data, (err) => {
        fs.close(fd, (err) => {
          if (err) throw err;
        });
        if (err) throw err;
      });
    });
  });

  ipcMain.handle('delete', async (_event, filePath) => {
    return await fs.unlink(filePath);
  });

  ipcMain.handle('copyFile', async (_event, from, to) => {
    return await fs.copyFile(from, to);
  });

  ipcMain.handle('times', async (_event, filePath, create, update) => {
    return await fs.utimes(filePath, create, update);
  });

  ipcMain.handle('readDir', async (_event, folder) => {
    try {
      return fs.readdirSync(folder);
    } catch (err) {
      return JSON.stringify(err);
    }
  });

  ipcMain.handle('fileJson', async (_event, settings) => {
    if (fs.existsSync(settings)) {
      const data = fs.readFileSync(settings, 'utf-8');
      return convert.xml2json(data, { compact: true, spaces: 2 });
    }
    return null;
  });

  ipcMain.handle('importOpen', async () => {
    const options = {
      filters: [{ name: 'ptf', extensions: ['ptf'] }],
      properties: ['openFile'],
    };
    return dialog.showOpenDialogSync(options as any);
  });

  ipcMain.handle('audacityOpen', async () => {
    return dialog.showOpenDialogSync({
      filters: [{ name: 'Audacity', extensions: ['aup3'] }],
      properties: ['openFile'],
    });
  });

  ipcMain.handle('openExternal', async (_event, cmd) => {
    return await shell.openExternal(cmd);
  });

  ipcMain.handle('openPath', async (_event, cmd) => {
    return await shell.openPath(cmd);
  });

  ipcMain.handle('exec', async (_event, cmd, args, opts) => {
    return JSON.stringify(await execa(cmd, args, opts));
  });

  ipcMain.handle('exeCmd', async (_event, cmd, opts) => {
    return JSON.stringify(await execa.call(cmd, opts));
  });

  const admZip = new Map();
  ipcMain.handle('zipOpen', async (_event, fullPath) => {
    const index = generateUUID();
    admZip.set(index, fullPath ? new AdmZip(fullPath) : new AdmZip());
    return index;
  });

  ipcMain.handle('zipGetEntries', async (_event, zip) => {
    return JSON.stringify(admZip.get(zip).getEntries());
  });

  ipcMain.handle('zipReadText', async (_event, zip, name) => {
    return admZip.get(zip).readAsText(name);
  });

  ipcMain.handle('zipAddFile', async (_event, zip, name, data, comment) => {
    admZip.get(zip).addFile(name, Buffer.alloc(data.length, data), comment);
    return true;
  });

  ipcMain.handle('zipAddJson', async (_event, zip, name, data, comment) => {
    admZip.get(zip).addFile(name, Buffer.from(JSON.parse(data)), comment);
    return true;
  });

  ipcMain.handle('zipAddZip', async (_event, zip, name, addZip, comment) => {
    admZip.get(zip).addFile(name, admZip.get(addZip).toBuffer(), comment);
    return true;
  });

  ipcMain.handle('zipAddLocal', async (_event, zip, full, folder, base) => {
    admZip.get(zip).addLocalFile(full, folder, base);
    return true;
  });

  ipcMain.handle('zipToBuffer', async (_event, zip) => {
    return admZip.get(zip).toBuffer();
  });

  ipcMain.handle('zipWrite', async (_event, zip, where) => {
    admZip.get(zip).writeZip(where);
    return true;
  });

  ipcMain.handle('zipExtract', async (_event, zip, folder, replace) => {
    admZip.get(zip).extractAllTo(folder, replace);
    return true;
  });

  ipcMain.handle('zipClose', async (_event, zip) => {
    admZip.delete(zip);
  });

  ipcMain.handle('zipStreamExtract', async (_event, zip, folder) => {
    const zipStrm = new StreamZip.async({ file: zip });
    const count = await zipStrm.extract(null, folder);
    console.log(`Extracted ${count} entries`);
    await zipStrm.close();
    return true;
  });

  const zipStr = new Map();
  ipcMain.handle('zipStreamOpen', async (_event, fullPath) => {
    const index = generateUUID();
    zipStr.set(
      index,
      new StreamZip.async({ file: fullPath, nameEncoding: 'utf8' })
    );
    return index;
  });

  ipcMain.handle('zipStreamEntries', async (_event, zip) => {
    return JSON.stringify(await zipStr.get(zip).entries());
  });

  ipcMain.handle('zipStreamEntry', async (_event, zip, name) => {
    return JSON.stringify(await zipStr.get(zip).entry(name));
  });

  ipcMain.handle('zipStreamEntryData', async (_event, zip, name) => {
    return await zipStr.get(zip).entryData(name);
  });

  ipcMain.handle('zipStreamEntryText', async (_event, zip, name) => {
    const data = (await zipStr.get(zip).entryData(name)) as Uint8Array;
    return String.fromCharCode(...Array.from(data));
  });

  ipcMain.handle('zipStreamClose', async (_event, zip) => {
    if (zipStr.has(zip)) {
      await zipStr.get(zip).close();
      zipStr.delete(zip);
    }
  });

  ipcMain.handle('writeBuffer', async (_event, filePath, arrayBuffer) => {
    if (process.platform === 'win32') {
      filePath = filePath.replace(/\//g, '\\');
    }
    try {
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  });

  let isLogingIn = false;
  let isLogOut = false;

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !isLogingIn) {
      app.quit();
    }
  });

  ipcMain.handle('login', async (_event, hasUsed, email) => {
    isLogingIn = true;
    isLogOut = false;
    try {
      await refreshTokens();
      isLogingIn = false;
      return createWindow();
    } catch {
      isLogingIn = false;
      createAuthWindow(hasUsed, email);
    }
  });

  ipcMain.handle('get-profile', async () => {
    if (isLogOut) return null;
    return getProfile();
  });

  ipcMain.handle('get-token', async () => {
    if (isLogOut) return null;
    return getAccessToken();
  });

  ipcMain.handle('refresh-token', async () => {
    if (isLogOut) return null;
    return refreshTokens();
  });

  ipcMain.handle('logout', async () => {
    isLogingIn = false;
    isLogOut = true;
    createLogoutWindow();
  });

  ipcMain.handle('downloadFile', async (_event, url, localFile) => {
    if (process.platform === 'win32')
      localFile = localFile.replace(/\//g, '\\');
    try {
      await downloadFile(url, localFile);
      return;
    } catch (err) {
      return JSON.stringify(err);
    }
  });

  ipcMain.handle('downloadLaunch', async (_event, url, localFile) => {
    if (process.platform === 'win32')
      localFile = localFile.replace(/\//g, '\\');
    const token = generateUUID();
    await downloadFile(url, localFile, token);
    return token;
  });

  ipcMain.handle('downloadStat', async (_event, token) => {
    return downloadStatus(token);
  });

  ipcMain.handle('downloadClose', async (_event, token) => {
    downloadClose(token);
    return;
  });

  ipcMain.handle('normalize', async (_event, input, output) => {
    if (process.platform === 'win32') {
      input = input.replace(/\//g, '\\');
      output = output.replace(/\//g, '\\');
    }
    const { normalize } = await import('./normalizer');
    try {
      // see: https://github.com/peterforgacs/ffmpeg-normalize/blob/master/src/normalizer.ts
      // see: https://www.electronjs.org/docs/latest/tutorial/asar-archives#executing-binaries-inside-asar-archive
      // we modified the code from ffmpeg-normalize to our style requirements
      await normalize({
        input,
        output,
        loudness: {
          normalization: 'ebuR128',
          target: {
            input_i: -23,
            input_lra: 7.0,
            input_tp: -2.0,
          },
        },
        verbose: true,
      });
      return;
    } catch (error) {
      console.error(error);
      return JSON.stringify(error);
    }
  });
}
