export type TitleMediaPending = {
  /** Visible sheet index at enqueue time (fallback if ids missing). */
  index: number;
  mediaId: string;
  sectionId?: string;
  passageId?: string;
  label?: string;
};

export type PendingTitleMediaQueueDeps = {
  isBusy: () => boolean;
  /**
   * Invoke `fn` once the sheet is idle. May return a Promise that rejects on
   * timeout — the queue retries and must never drop pending updates.
   */
  whenIdle: (fn: () => void) => void | Promise<void>;
  applyOne: (pending: TitleMediaPending) => void;
  requestSave: () => void;
};

export type PendingTitleMediaQueue = {
  enqueue: (pending: TitleMediaPending) => void;
};

const pendingKey = (p: TitleMediaPending) =>
  p.sectionId || p.passageId || `idx:${p.index}`;

/**
 * Coalesce title-media changes by stable section/passage id and flush them
 * when the sheet is idle. Continuous recording must not lose updates while a
 * save is in flight (TT-7660).
 */
export function createPendingTitleMediaQueue(
  deps: PendingTitleMediaQueueDeps
): PendingTitleMediaQueue {
  const pending = new Map<string, TitleMediaPending>();
  let waiting = false;

  const flush = () => {
    if (pending.size === 0) {
      waiting = false;
      return;
    }
    if (deps.isBusy()) {
      schedule();
      return;
    }
    waiting = false;
    const batch = [...pending.values()];
    pending.clear();
    for (const item of batch) {
      deps.applyOne(item);
    }
    deps.requestSave();
    if (pending.size > 0) flush();
  };

  const schedule = () => {
    if (waiting) return;
    waiting = true;
    const result = deps.whenIdle(() => {
      waiting = false;
      flush();
    });
    if (result != null && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch(() => {
        waiting = false;
        if (pending.size > 0) schedule();
      });
    }
  };

  return {
    enqueue(item: TitleMediaPending) {
      pending.set(pendingKey(item), item);
      if (deps.isBusy()) {
        schedule();
      } else {
        flush();
      }
    },
  };
}
