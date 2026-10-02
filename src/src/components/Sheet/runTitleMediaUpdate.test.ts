import { runTitleMediaUpdate } from './runTitleMediaUpdate';

describe('runTitleMediaUpdate', () => {
  it('applies title media after the sheet becomes idle instead of dropping', async () => {
    let busy = true;
    const applied: string[] = [];
    const saves: number[] = [];

    runTitleMediaUpdate({
      isBusy: () => busy,
      whenIdle: (fn) => {
        setTimeout(() => {
          busy = false;
          fn();
        }, 10);
      },
      apply: () => applied.push('media-row-2'),
      requestSave: () => saves.push(1),
    });

    // Dropping while busy leaves applied empty — that is the TT-7660 defect.
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (applied.length === 1 && applied[0] === 'media-row-2') {
          resolve();
          return;
        }
        if (Date.now() - start > 1000) {
          reject(
            new Error(
              `expected apply after idle; applied=${JSON.stringify(applied)}`
            )
          );
          return;
        }
        setTimeout(tick, 5);
      };
      tick();
    });

    expect(applied).toEqual(['media-row-2']);
    expect(saves).toHaveLength(1);
  });

  it('applies and requests save immediately when the sheet is idle', () => {
    const applied: string[] = [];
    const saves: number[] = [];

    runTitleMediaUpdate({
      isBusy: () => false,
      whenIdle: (fn) => fn(),
      apply: () => applied.push('media-row-1'),
      requestSave: () => saves.push(1),
    });

    expect(applied).toEqual(['media-row-1']);
    expect(saves).toHaveLength(1);
  });
});
