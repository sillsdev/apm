import { launch, launchFilePath } from './launch';

const jpg = 'C:/Users/shent/transcriber/media/WEB-0013_agama_lizard.jpg';

function mockApi(isWindows: boolean) {
  const api = {
    openPath: jest.fn().mockResolvedValue(''),
    openExternal: jest.fn(),
    exec: jest.fn().mockResolvedValue(''),
    exeCmd: jest.fn(),
    isWindows: jest.fn().mockResolvedValue(isWindows),
  };
  (
    window as unknown as {
      api: typeof api;
    }
  ).api = api;
  return api;
}

describe('launchFilePath', () => {
  it('keeps a bare Windows path', () => {
    expect(launchFilePath(jpg)).toBe(jpg);
  });

  it('strips file:// so openPath gets the filesystem path', () => {
    expect(launchFilePath(`file://${jpg}`)).toBe(jpg);
    expect(launchFilePath(`file:///${jpg}`)).toBe(jpg);
  });

  it('keeps the leading slash on POSIX file URLs', () => {
    expect(launchFilePath('file:///home/user/media/photo.jpg')).toBe(
      '/home/user/media/photo.jpg'
    );
  });

  it('does not drop the drive-letter prefix (former slice(18) bug)', () => {
    const opened = launchFilePath(`file://${jpg}`);
    expect(opened.startsWith('C:/')).toBe(true);
    expect(opened).not.toMatch(/^hent\//);
  });

  it('leaves percent characters in bare paths alone', () => {
    expect(launchFilePath('C:/Media/100% complete.jpg')).toBe(
      'C:/Media/100% complete.jpg'
    );
    expect(launchFilePath('C:/Media/100%20complete.jpg')).toBe(
      'C:/Media/100%20complete.jpg'
    );
  });

  it('decodes percent-escapes only in file URLs', () => {
    expect(launchFilePath('file:///C:/Media/100%20complete.jpg')).toBe(
      'C:/Media/100 complete.jpg'
    );
    expect(launchFilePath('file:///home/alice/100%20complete.jpg')).toBe(
      '/home/alice/100 complete.jpg'
    );
  });

  it('keeps the UNC host', () => {
    expect(launchFilePath('file://server/share/manual.pdf')).toBe(
      '//server/share/manual.pdf'
    );
  });
});

describe('launch Windows local image', () => {
  it('uses openPath with the filesystem path even when online', async () => {
    const api = mockApi(true);
    await launch(`file://${jpg}`, true);
    expect(api.openExternal).not.toHaveBeenCalled();
    expect(api.exeCmd).not.toHaveBeenCalled();
    expect(api.openPath).toHaveBeenCalledWith(jpg);
  });
});

describe('launch external URI schemes', () => {
  it('opens mailto with openExternal on Windows, not as a local path', async () => {
    const api = mockApi(true);
    const mailto = 'mailto:support@example.org';
    await launch(mailto, true);
    expect(api.openPath).not.toHaveBeenCalled();
    expect(api.openExternal).toHaveBeenCalledWith(mailto);
  });

  it('opens mailto with openExternal on Linux, without a file:// prefix', async () => {
    const api = mockApi(false);
    const mailto = 'mailto:support@example.org';
    await launch(mailto, true);
    expect(api.openPath).not.toHaveBeenCalled();
    expect(api.openExternal).toHaveBeenCalledWith(mailto);
  });

  it('does not treat a Windows drive path as a URI scheme', async () => {
    const api = mockApi(true);
    await launch(jpg, true);
    expect(api.openExternal).not.toHaveBeenCalled();
    expect(api.openPath).toHaveBeenCalledWith(jpg);
  });

  it('does not forward arbitrary protocol handlers to the OS', async () => {
    const api = mockApi(true);
    await launch('ms-msdt:foo', true);
    await launch('smb://evil/share', true);
    await launch('javascript:alert(1)', true);
    expect(api.openExternal).not.toHaveBeenCalled();
    expect(api.openPath).not.toHaveBeenCalled();
  });
});

describe('launch Linux online local file', () => {
  it('does not double-prefix mixed-case file URLs', async () => {
    const api = mockApi(false);
    const url = 'FILE:///home/user/media/photo.jpg';
    await launch(url, true);
    expect(api.openPath).not.toHaveBeenCalled();
    expect(api.openExternal).toHaveBeenCalledWith(url);
  });
});

describe('launch Linux offline local file', () => {
  it('opens a jpg with openPath, not a shell command string', async () => {
    const api = mockApi(false);
    await launch(`file:///home/user/media/photo.jpg`, false);
    expect(api.exeCmd).not.toHaveBeenCalled();
    expect(api.openPath).toHaveBeenCalledWith('/home/user/media/photo.jpg');
  });

  it('runs a .sh script via exec argv, not concatenated exeCmd', async () => {
    const api = mockApi(false);
    const sh = '/opt/apm/resources/resetData.sh';
    await launch(sh, false);
    expect(api.exeCmd).not.toHaveBeenCalled();
    expect(api.exec).toHaveBeenCalledWith('sh', [sh], expect.any(Object));
  });

  it('passes a filename with shell syntax as a single argument', async () => {
    const api = mockApi(false);
    const evil = '/tmp/x; touch /tmp/pwned.sh';
    await launch(evil, false);
    expect(api.exeCmd).not.toHaveBeenCalled();
    expect(api.exec).toHaveBeenCalledWith('sh', [evil], expect.any(Object));
  });
});
