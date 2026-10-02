export type RunTitleMediaUpdateArgs = {
  isBusy: () => boolean;
  whenIdle: (fn: () => void) => void;
  apply: () => void;
  requestSave: () => void;
};

/**
 * Apply a title-media change and request a sheet save.
 * Must not drop updates while the sheet is busy — queue via whenIdle instead.
 */
export function runTitleMediaUpdate({
  isBusy,
  whenIdle,
  apply,
  requestSave,
}: RunTitleMediaUpdateArgs): void {
  const go = () => {
    apply();
    requestSave();
  };
  if (isBusy()) {
    whenIdle(go);
    return;
  }
  go();
}
