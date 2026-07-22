/**
 * Lightweight, opt-in performance instrumentation.
 *
 * Goal: find out why the app becomes unresponsive — which components re-render
 * in storms, which effects/memos are slow, which global-state keys churn, and
 * what long-tasks block the main thread (so clicks/dialogs feel delayed).
 *
 * ── Turn it on (in the app's devtools console) ─────────────────────────────
 *     aptPerf.on()        // enables + reloads
 *   or set localStorage 'perfDebug' = '1' and reload.
 *
 * ── Reproduce the problem, then get a report ───────────────────────────────
 *     aptPerf.report()    // prints tables + copies a text report to clipboard
 *     aptPerf.reset()     // zero the counters (e.g. right before a repro step)
 *     aptPerf.auto(5000)  // print a compact summary every 5s (0 to stop)
 *     aptPerf.off()       // disable + reload
 *
 * Everything is a no-op with near-zero cost when disabled, so it is safe to
 * leave the instrumentation calls in place.
 */

/* eslint-disable react-hooks/refs */
// This is an opt-in debug utility: it intentionally reads refs across renders
// (to compare previous vs current values) and logs to the console.
import { useEffect, useMemo, useRef } from 'react';

const FLAG = 'perfDebug';

let enabled = false;
try {
  enabled =
    typeof localStorage !== 'undefined' && localStorage.getItem(FLAG) === '1';
} catch {
  enabled = false;
}

export const perfEnabled = (): boolean => enabled;

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : 0;

type Kind = 'render' | 'effect' | 'memo' | 'global' | 'longtask' | 'fn';

interface Stat {
  kind: Kind;
  label: string;
  count: number;
  totalMs: number;
  maxMs: number;
  lastTs: number;
  /** recent fire times (perf clock) for burst/storm detection */
  recent: number[];
  /** for effects/memos: how many times a given dep index was the one that changed */
  depChanges?: Record<number, number>;
}

const registry = new Map<string, Stat>();
const RECENT_WINDOW_MS = 1000;
const RECENT_MAX = 200;

const keyFor = (kind: Kind, label: string) => `${kind}::${label}`;

const stat = (kind: Kind, label: string): Stat => {
  const k = keyFor(kind, label);
  let s = registry.get(k);
  if (!s) {
    s = { kind, label, count: 0, totalMs: 0, maxMs: 0, lastTs: 0, recent: [] };
    registry.set(k, s);
  }
  return s;
};

const record = (kind: Kind, label: string, ms: number, depIdx?: number) => {
  const s = stat(kind, label);
  const t = now();
  s.count += 1;
  s.totalMs += ms;
  if (ms > s.maxMs) s.maxMs = ms;
  s.lastTs = t;
  s.recent.push(t);
  if (s.recent.length > RECENT_MAX) s.recent.shift();
  if (depIdx !== undefined && depIdx >= 0) {
    if (!s.depChanges) s.depChanges = {};
    s.depChanges[depIdx] = (s.depChanges[depIdx] ?? 0) + 1;
  }
};

/** peak fires within any RECENT_WINDOW_MS sliding window (storm intensity) */
const peakBurst = (s: Stat): number => {
  if (s.recent.length === 0) return 0;
  let peak = 0;
  let start = 0;
  for (let end = 0; end < s.recent.length; end++) {
    while (s.recent[end] - s.recent[start] > RECENT_WINDOW_MS) start++;
    peak = Math.max(peak, end - start + 1);
  }
  return peak;
};

// ── Public recording helpers (used by non-hook call sites) ──────────────────

/** Record an explicit global-state key mutation (called from useGlobal setter). */
export const perfRecordGlobalSet = (prop: string): void => {
  if (!enabled) return;
  record('global', prop, 0);
};

/** Record a pre-measured duration (for async work you time yourself). */
export const perfRecordMs = (label: string, ms: number): void => {
  if (!enabled) return;
  record('fn', label, ms);
};

/** Time an arbitrary function and record it under `label`. */
export const perfTime = <T>(label: string, fn: () => T): T => {
  if (!enabled) return fn();
  const t = now();
  try {
    return fn();
  } finally {
    record('fn', label, now() - t);
  }
};

// ── Chronological trace (for ordering / race diagnosis) ─────────────────────
// The aggregate stats above answer "how often / how slow". A race needs the
// opposite: the exact ORDER of async milestones and the gaps between them.
// perfTrace appends to a ring buffer you dump with `aptPerf.trace()`.

interface TraceEvent {
  seq: number;
  tMs: number; // perf clock at capture
  label: string;
  data?: Record<string, unknown>;
}

const TRACE_MAX = 1000;
const traceBuf: TraceEvent[] = [];
let traceSeq = 0;

/**
 * Append one ordered milestone to the trace buffer. No-op when disabled.
 * Also mirrors to the console (grouped/greppable) so it interleaves with the
 * app's existing diagnostics in real time — critical for spotting a step that
 * fires twice, out of order, or never completes.
 */
export const perfTrace = (
  label: string,
  data?: Record<string, unknown>
): void => {
  if (!enabled) return;
  const evt: TraceEvent = { seq: ++traceSeq, tMs: now(), label, data };
  traceBuf.push(evt);
  if (traceBuf.length > TRACE_MAX) traceBuf.shift();
  const dataStr = data ? ' ' + JSON.stringify(data) : '';

  console.log(
    `%c[aptTrace #${evt.seq} @${fmt(evt.tMs)}ms] ${label}${dataStr}`,
    'color:#0a7'
  );
};

const traceReport = (): string => {
  if (!traceBuf.length) return '[aptTrace] (empty — reproduce the issue first)';
  const first = traceBuf[0]!.tMs;
  const lines = traceBuf.map((e, i) => {
    const rel = fmt(e.tMs - first);
    const delta = i > 0 ? fmt(e.tMs - traceBuf[i - 1]!.tMs) : 0;
    const dataStr = e.data ? '  ' + JSON.stringify(e.data) : '';
    return `#${e.seq}  +${rel}ms  (Δ${delta}ms)  ${e.label}${dataStr}`;
  });
  const text =
    `# aptTrace — ${traceBuf.length} events (chronological)\n` +
    lines.join('\n') +
    '\n';

  console.log(text);
  try {
    (navigator as any)?.clipboard?.writeText?.(text);

    console.log('%c[aptTrace] trace copied to clipboard', 'color:green');
  } catch {
    /* clipboard unavailable */
  }
  return text;
};

const traceReset = () => {
  traceBuf.length = 0;
  traceSeq = 0;

  console.log('[aptTrace] trace cleared');
};

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Count renders of a component and detect render storms.
 * Drop `useRenderProfiler('MyComponent')` at the top of a component body.
 */
export const useRenderProfiler = (label: string): void => {
  const last = useRef(0);
  if (!enabled) return;
  const t = now();
  const delta = last.current ? t - last.current : 0;
  last.current = t;
  // ms field here stores inter-render gap so maxMs = longest gap (not useful);
  // we mainly want count + burst, so store 0 for time.
  record('render', label, 0);
  // stash the tightest gap in depChanges[0] as a proxy (optional)
  if (delta > 0 && delta < 16) {
    const s = stat('render', label);
    s.depChanges = s.depChanges ?? {};
    s.depChanges[0] = (s.depChanges[0] ?? 0) + 1; // renders <16ms apart (back-to-back)
  }
};

const changedDepIndex = (
  prev: readonly any[] | undefined,
  next: readonly any[]
): number => {
  if (!prev) return -1;
  const len = Math.max(prev.length, next.length);
  for (let i = 0; i < len; i++) {
    if (!Object.is(prev[i], next[i])) return i;
  }
  return -1;
};

/**
 * Drop-in replacement for useEffect that times the effect body and records
 * which dependency index changed to trigger it.
 */
export const useTimedEffect = (
  label: string,
  effect: () => void | (() => void),
  deps: readonly any[]
): void => {
  const prev = useRef<readonly any[] | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return effect();
    const depIdx = changedDepIndex(prev.current, deps);
    prev.current = deps;
    const t = now();
    const cleanup = effect();
    record('effect', label, now() - t, depIdx);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

/**
 * Drop-in replacement for useMemo that times the factory and records which
 * dependency changed to trigger the recompute.
 */
export const useTimedMemo = <T>(
  label: string,
  factory: () => T,
  deps: readonly any[]
): T => {
  const prev = useRef<readonly any[] | undefined>(undefined);

  return useMemo(() => {
    if (!enabled) return factory();
    const depIdx = changedDepIndex(prev.current, deps);
    prev.current = deps;
    const t = now();
    const value = factory();
    record('memo', label, now() - t, depIdx);
    return value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

/**
 * Log which *named* dependency changed between renders — the fastest way to
 * find "why is this component re-rendering so much". Pass an object of the
 * props/values you suspect: useWhyRender('UserMenu', { user, users, org }).
 */
export const useWhyRender = (
  label: string,
  watched: Record<string, any>
): void => {
  const prev = useRef<Record<string, any> | undefined>(undefined);
  if (!enabled) return;
  const before = prev.current;
  prev.current = { ...watched };
  if (!before) return;
  const changed: string[] = [];
  for (const k of Object.keys(watched)) {
    if (!Object.is(before[k], watched[k])) changed.push(k);
  }
  if (changed.length) {
    for (const k of changed) record('render', `${label}⇐${k}`, 0);
  } else {
    // re-rendered but none of the watched values changed → parent/context churn
    record('render', `${label}⇐(context/parent)`, 0);
  }
};

// ── Long-task observer (why do clicks/dialogs feel delayed?) ────────────────

let longTaskObserver: PerformanceObserver | undefined;
const startLongTaskObserver = () => {
  if (
    !enabled ||
    longTaskObserver ||
    typeof PerformanceObserver === 'undefined'
  )
    return;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        record('longtask', 'main-thread-block', entry.duration);
        if (entry.duration >= 200) {
          console.warn(
            `[aptPerf] LONG TASK ${Math.round(entry.duration)}ms blocked the main thread`
          );
        }
      }
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch {
    /* longtask not supported */
  }
};

// ── Reporting ───────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.round(n * 10) / 10;

const buildReport = (): string => {
  const lines: string[] = [];
  const all = [...registry.values()];

  const section = (
    title: string,
    kinds: Kind[],
    sortBy: (s: Stat) => number,
    cols: (s: Stat) => Record<string, string | number>
  ) => {
    const rows = all
      .filter((s) => kinds.includes(s.kind))
      .sort((a, b) => sortBy(b) - sortBy(a))
      .slice(0, 40);
    if (!rows.length) return;
    lines.push(`\n## ${title}`);
    for (const s of rows) {
      const c = cols(s);
      lines.push(
        '  ' +
          Object.entries(c)
            .map(([k, v]) => `${k}=${v}`)
            .join('  ')
      );
    }
    // also print as a table for interactive inspection

    console.log(`%c${title}`, 'font-weight:bold');

    console.table(rows.map((s) => cols(s)));
  };

  section(
    'RENDERS (by count) — look for storms: high count + high peak/sec',
    ['render'],
    (s) => s.count,
    (s) => ({
      component: s.label,
      renders: s.count,
      'peak/sec': peakBurst(s),
      'back2back<16ms': s.depChanges?.[0] ?? 0,
    })
  );

  section(
    'EFFECTS (by total ms) — slow or too-frequent effects',
    ['effect'],
    (s) => s.totalMs,
    (s) => ({
      effect: s.label,
      runs: s.count,
      totalMs: fmt(s.totalMs),
      maxMs: fmt(s.maxMs),
      'peak/sec': peakBurst(s),
      hotDep: s.depChanges
        ? Object.entries(s.depChanges).sort((a, b) => b[1] - a[1])[0]?.[0]
        : '',
    })
  );

  section(
    'MEMOS (by total ms) — expensive or thrashing memos',
    ['memo'],
    (s) => s.totalMs,
    (s) => ({
      memo: s.label,
      recomputes: s.count,
      totalMs: fmt(s.totalMs),
      maxMs: fmt(s.maxMs),
      'peak/sec': peakBurst(s),
      hotDep: s.depChanges
        ? Object.entries(s.depChanges).sort((a, b) => b[1] - a[1])[0]?.[0]
        : '',
    })
  );

  section(
    'GLOBAL STATE writes (by count) — cascade drivers',
    ['global'],
    (s) => s.count,
    (s) => ({ key: s.label, writes: s.count, 'peak/sec': peakBurst(s) })
  );

  section(
    'PLAIN FUNCTIONS (by total ms)',
    ['fn'],
    (s) => s.totalMs,
    (s) => ({
      fn: s.label,
      calls: s.count,
      totalMs: fmt(s.totalMs),
      maxMs: fmt(s.maxMs),
    })
  );

  const lt = registry.get(keyFor('longtask', 'main-thread-block'));
  if (lt) {
    lines.push(
      `\n## LONG TASKS (main-thread blocks ≥50ms — cause of click/dialog delay)`
    );
    lines.push(
      `  count=${lt.count}  totalMs=${fmt(lt.totalMs)}  worstMs=${fmt(lt.maxMs)}  peak/sec=${peakBurst(lt)}`
    );
  }

  const header =
    `# aptPerf report @ ${new Date().toISOString()}\n` +
    `enabled=${enabled}  tracked=${registry.size} labels`;
  return header + '\n' + lines.join('\n') + '\n';
};

const report = (): string => {
  const text = buildReport();

  console.log(text);
  try {
    // best-effort clipboard copy so the report is easy to paste back
    (navigator as any)?.clipboard?.writeText?.(text);

    console.log('%c[aptPerf] report copied to clipboard', 'color:green');
  } catch {
    /* clipboard unavailable */
  }
  return text;
};

const reset = () => {
  registry.clear();

  console.log('[aptPerf] counters reset');
};

let autoTimer: ReturnType<typeof setInterval> | undefined;
const auto = (ms: number) => {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = undefined;
  }
  if (ms > 0) {
    autoTimer = setInterval(() => {
      const renders = [...registry.values()]
        .filter((s) => s.kind === 'render')
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((s) => `${s.label}:${s.count}`)
        .join('  ');

      console.log(`[aptPerf] top renders — ${renders}`);
    }, ms);
  }
};

const on = () => {
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    /* ignore */
  }
  location.reload();
};
const off = () => {
  try {
    localStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
  location.reload();
};

// Expose a console API regardless of enabled state so `aptPerf.on()` works.
if (typeof window !== 'undefined') {
  (window as any).aptPerf = {
    on,
    off,
    report,
    reset,
    auto,
    trace: traceReport,
    traceReset,
    enabled: () => enabled,
    _registry: registry,
    _trace: traceBuf,
  };
}

if (enabled) {
  startLongTaskObserver();

  console.log(
    '%c[aptPerf] instrumentation ON — reproduce the issue, then run aptPerf.report()',
    'color:orange;font-weight:bold'
  );
}
