import { launchFilePath } from './launch';

const jpg = 'C:/Users/shent/transcriber/media/WEB-0013_agama_lizard.jpg';

describe('launchFilePath', () => {
  it('keeps a bare Windows path', () => {
    expect(launchFilePath(jpg)).toBe(jpg);
  });

  it('strips file:// so openPath gets the filesystem path', () => {
    expect(launchFilePath(`file://${jpg}`)).toBe(jpg);
    expect(launchFilePath(`file:///${jpg}`)).toBe(jpg);
  });

  it('does not drop the drive-letter prefix (former slice(18) bug)', () => {
    const opened = launchFilePath(`file://${jpg}`);
    expect(opened.startsWith('C:/')).toBe(true);
    expect(opened).not.toMatch(/^hent\//);
  });
});

describe('launch Windows local image', () => {
  it('uses openPath with the filesystem path even when online', async () => {
    jest.resetModules();
    const openPath = jest.fn().mockResolvedValue('');
    const openExternal = jest.fn();
    (
      window as unknown as {
        api: {
          openPath: jest.Mock;
          openExternal: jest.Mock;
          isWindows: jest.Mock;
        };
      }
    ).api = {
      openPath,
      openExternal,
      isWindows: jest.fn().mockResolvedValue(true),
    };
    const { launch } = require('./launch');
    await launch(`file://${jpg}`, true);
    expect(openExternal).not.toHaveBeenCalled();
    expect(openPath).toHaveBeenCalledWith(jpg);
  });
});
