/**
 * TT-7621 hang-state tracing helper (TEMPORARY — remove before merge).
 *
 * Purpose: instrument the code that runs when the user toggles between the
 * "Phrase Back Translate" and "Phrase BT Transcribe" workflow steps, or selects
 * segments within Phrase Back Translate, so we can see in the console where the
 * freeze happens and whether any effect/render is firing in a tight loop.
 *
 * All output is prefixed with `[TT7621]` so it can be filtered in DevTools.
 * Enable/disable at runtime from the console: `window.__tt7621 = false`.
 */

interface TraceWindow extends Window {
  __tt7621?: boolean;
}

const w = typeof window !== 'undefined' ? (window as TraceWindow) : undefined;

// Default on. Flip off live with `window.__tt7621 = false`.
if (w && w.__tt7621 === undefined) w.__tt7621 = true;

const enabled = () => !!(w && w.__tt7621);

// High-resolution, monotonic-ish timestamp relative to page load.
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

// --- rapid-fire loop detection -------------------------------------------
// If the same labelled event fires many times inside a short window, we very
// likely found an infinite/feedback loop. We report a warning once per burst.
const hits = new Map<
  string,
  { count: number; windowStart: number; warned: boolean }
>();
const WINDOW_MS = 1000;
const BURST_THRESHOLD = 30; // >30 identical events / second == suspicious

function bump(label: string): number {
  const t = now();
  let h = hits.get(label);
  if (!h || t - h.windowStart > WINDOW_MS) {
    h = { count: 0, windowStart: t, warned: false };
    hits.set(label, h);
  }
  h.count += 1;
  if (h.count === BURST_THRESHOLD && !h.warned) {
    h.warned = true;
    console.warn(
      `[TT7621] 🔥 LOOP? "${label}" fired ${h.count}× in <${Math.round(
        t - h.windowStart
      )}ms — possible feedback loop / infinite render`
    );
  }
  return h.count;
}

/** Log a point-in-time event with optional structured data. */
export function ttTrace(label: string, data?: Record<string, unknown>): void {
  if (!enabled()) return;
  const n = bump(label);
  if (data) {
    console.log(`[TT7621] ${label} (#${n} @${now().toFixed(0)}ms)`, data);
  } else {
    console.log(`[TT7621] ${label} (#${n} @${now().toFixed(0)}ms)`);
  }
}

/**
 * Log a component render and return its render count. Call at the top of a
 * component body. A steadily-climbing count with no user action == a render
 * loop.
 */
export function ttRender(
  component: string,
  data?: Record<string, unknown>
): number {
  if (!enabled()) return 0;
  const n = bump(`render:${component}`);
  if (data) {
    console.log(
      `[TT7621] render ${component} (#${n} @${now().toFixed(0)}ms)`,
      data
    );
  } else {
    console.log(`[TT7621] render ${component} (#${n} @${now().toFixed(0)}ms)`);
  }
  return n;
}

/** Log an effect firing together with the dependency values that triggered it. */
export function ttEffect(label: string, deps?: Record<string, unknown>): void {
  ttTrace(`effect:${label}`, deps);
}

/** Wrap a short id/blob url so logs stay readable. */
export function ttShort(v: unknown): string {
  if (v == null) return String(v);
  const s = String(v);
  return s.length > 24 ? `${s.slice(0, 12)}…${s.slice(-8)}` : s;
}

/**
 * Return the first `frames` caller frames (skipping this helper + the immediate
 * caller) as a compact "fn@file:line › fn@file:line" string, so a mutation log
 * can say WHO triggered it without a full stack dump.
 */
export function ttStack(frames = 2): string {
  const raw = new Error().stack;
  if (!raw) return '(no stack)';
  const lines = raw
    .split('\n')
    .slice(2) // drop "Error" + this ttStack frame
    .map(
      (l) =>
        l
          .trim()
          .replace(/^at\s+/, '')
          // strip everything before the last path segment, keep fn + file:line:col
          .replace(/\(?https?:\/\/[^) ]*\/([^/) ]+)\)?/, '$1')
          .replace(/\?[^:) ]*/, '') // drop vite query strings
    )
    .filter((l) => l && !l.includes('tt7621trace'));
  return lines.slice(0, frames).join(' › ');
}
