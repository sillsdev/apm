import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import DataSheet from 'react-datasheet';
import { debounce } from '@mui/material';
import MemorySource from '@orbit/memory';
import type { ICell } from './PlanSheet';
import { ISheet } from '../../model';
import { rememberCurrentPassage } from '../../utils/rememberCurrentPassage';
import {
  absToSheet as absIndexToSheet,
  pinWindowTarget,
  sheetCurrentIndex,
  sheetToAbs as sheetIndexToAbs,
  visibleSheetSelection,
} from './planSheetViewport';
import {
  curTopFromViewport,
  isSheetScrollTarget,
  minDataRowHeight,
  overflowScrollParent,
  overscanOf,
  pageSizeForView,
  scrollTopFloorForPad,
  sheetWindow,
  visibleClip,
} from './sheetWindow';

const DOWN_ARROW = 'ARROWDOWN';

export interface PlanSheetScrollDeps {
  data: ICell[][];
  rowInfo: ISheet[];
  memory: MemorySource;
  rowHeight: number;
  pageSize: number;
  curTop: number;
  setCurTop: Dispatch<SetStateAction<number>>;
  setRowHeight: (h: number) => void;
  setPageSize: (n: number) => void;
  currentRow: number;
  setCurrentRowx: Dispatch<SetStateAction<number>>;
  active: number;
  setActive: Dispatch<SetStateAction<number>>;
  absSel: { startI: number; endI: number; startJ: number; endJ: number };
  setAbsSel: Dispatch<
    SetStateAction<{
      startI: number;
      endI: number;
      startJ: number;
      endJ: number;
    }>
  >;
  currentRowRef: MutableRefObject<number>;
  startRowRef: MutableRefObject<number>;
  selectColRef: MutableRefObject<number>;
  windowFirstRef: MutableRefObject<number>;
  windowLastRef: MutableRefObject<number>;
  prevWindowFirstRef: MutableRefObject<number>;
  ignoreScrollCurTopRef: MutableRefObject<boolean>;
  ignoreScrollTimerRef: MutableRefObject<number>;
  sheetScrollRafRef: MutableRefObject<number>;
  topPadElRef: MutableRefObject<HTMLDivElement | null>;
  rowHeightRef: MutableRefObject<number>;
  pageSizeRef: MutableRefObject<number>;
  sheetRef: MutableRefObject<any>;
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  subscribe: (key: string, fn: () => boolean) => void;
  unsubscribe: (key: string) => void;
}

export function usePlanSheetScroll(deps: PlanSheetScrollDeps) {
  const {
    data,
    rowInfo,
    memory,
    rowHeight,
    pageSize,
    curTop,
    setCurTop,
    setRowHeight,
    setPageSize,
    currentRow,
    setCurrentRowx,
    active,
    setActive,
    absSel,
    setAbsSel,
    currentRowRef,
    startRowRef,
    selectColRef,
    windowFirstRef,
    windowLastRef,
    prevWindowFirstRef,
    ignoreScrollCurTopRef,
    ignoreScrollTimerRef,
    sheetScrollRafRef,
    topPadElRef,
    rowHeightRef,
    pageSizeRef,
    sheetRef,
    scrollRef,
    subscribe,
    unsubscribe,
  } = deps;

  const sheetToAbs = (sheetI: number) =>
    sheetIndexToAbs(sheetI, windowFirstRef.current);
  const absToSheet = (absI: number) =>
    absIndexToSheet(absI, windowFirstRef.current);

  const sheetClip = (el: HTMLElement) => overflowScrollParent(el) ?? el;

  const syncViewport = (remeasure = false) => {
    const scroller = scrollRef.current;
    const table = sheetRef.current?.querySelector(
      'table.data-grid'
    ) as HTMLTableElement | null;
    const firstH = table?.rows?.[1]?.offsetHeight || 0;
    if (firstH > 0 && (remeasure || rowHeightRef.current === 0)) {
      setRowHeight(firstH);
    }
    const h = rowHeightRef.current; //set by setRowHeight
    if (!scroller || h <= 0) return;
    const { height: clipHeight } = visibleClip(scroller, 0, window.innerHeight);
    const total = Math.max(0, data.length - 1);
    const minH = minDataRowHeight(table) || h;
    setPageSize(
      Math.min(pageSizeForView(minH, clipHeight), Math.max(1, total || 1))
    );
  };

  const releaseScrollCurTopIgnore = () => {
    window.clearTimeout(ignoreScrollTimerRef.current);
    ignoreScrollTimerRef.current = window.setTimeout(() => {
      ignoreScrollTimerRef.current = 0;
      ignoreScrollCurTopRef.current = false;
    }, 200);
  };

  /** Slide virtual window only if `row` is not mounted. Do not recenter. */
  const pinWindowToRow = (row: number): false | 'start' | 'end' => {
    const pin = pinWindowTarget({
      row,
      windowFirst: windowFirstRef.current,
      windowLast: windowLastRef.current,
      pageSize: pageSizeRef.current,
      dataLength: data.length,
    });
    if (!pin.edge || pin.desiredTop === undefined) return false;
    if (pin.desiredTop === curTop) return pin.edge;
    ignoreScrollCurTopRef.current = true;
    setCurTop(pin.desiredTop);
    return pin.edge;
  };

  /** Height of the sticky header row, which overlays the top of the scroller. */
  const headerHeight = () => {
    const table = sheetRef.current?.querySelector(
      'table.data-grid'
    ) as HTMLTableElement | null;
    return (table?.rows?.[0] as HTMLElement | undefined)?.offsetHeight ?? 0;
  };

  /** Scroll the scroller only if the row is clipped. `force` after a remount. */
  const alignRowInScroller = (
    scroller: HTMLElement,
    el: HTMLElement,
    force?: 'start' | 'end'
  ) => {
    const er = el.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    // Rows pass under the sticky header, so the usable top starts below it.
    const top = sr.top + headerHeight();
    if (force === 'start' || er.top < top) {
      scroller.scrollTop += er.top - top;
    } else if (force === 'end' || er.bottom > sr.bottom) {
      scroller.scrollTop += er.bottom - sr.bottom;
    }
  };

  /** Keep absolute data row in view. No scroll while it is fully visible. */
  const sheetScroll = () => {
    const scroller = scrollRef.current;
    const row = currentRowRef.current;
    if (!scroller || row < 1) return false;

    if (row <= 1) {
      ignoreScrollCurTopRef.current = true;
      // rows[1] is the first *mounted* row (windowFirst), not absolute row 1.
      const remounted = windowFirstRef.current > 1;
      if (curTop !== 1) setCurTop(1);
      if (scroller.scrollTop !== 0) scroller.scrollTop = 0;
      const intoView = () => {
        const table = sheetRef.current?.querySelector(
          'table.data-grid'
        ) as HTMLTableElement | null;
        const first = table?.rows?.[1] as HTMLElement | undefined;
        const clip = sheetClip(scroller);
        // Align in an ancestor only if row 1 is clipped — do not reset AppLayout to 0.
        if (first && clip !== scroller) alignRowInScroller(clip, first);
        releaseScrollCurTopIgnore();
      };
      window.cancelAnimationFrame(sheetScrollRafRef.current);
      if (remounted) {
        sheetScrollRafRef.current = requestAnimationFrame(() => {
          sheetScrollRafRef.current = requestAnimationFrame(() => {
            sheetScrollRafRef.current = 0;
            intoView();
          });
        });
      } else intoView();
      return false;
    }

    const remounted = pinWindowToRow(row);
    const intoView = (force?: 'start' | 'end') => {
      const table = sheetRef.current?.querySelector(
        'table.data-grid'
      ) as HTMLTableElement | null;
      const el = table?.rows?.[absToSheet(row)] as HTMLElement | undefined;
      if (el) alignRowInScroller(sheetClip(scroller), el, force);
      if (remounted) releaseScrollCurTopIgnore();
    };
    window.cancelAnimationFrame(sheetScrollRafRef.current);
    if (remounted) {
      sheetScrollRafRef.current = requestAnimationFrame(() => {
        sheetScrollRafRef.current = requestAnimationFrame(() => {
          sheetScrollRafRef.current = 0;
          intoView(remounted);
        });
      });
    } else intoView();
    return false;
  };
  const sheetScrollRef = useRef(sheetScroll);
  sheetScrollRef.current = sheetScroll;
  const syncViewportRef = useRef(syncViewport);
  syncViewportRef.current = syncViewport;

  // Debounced: toolbar state + passage memory + ensure row is in view.
  const commitCurrentRowNow = () => {
    const row = currentRowRef.current;
    if (row < 0) return;
    setCurrentRowx((prev) => (prev === row ? prev : row));
    if (row > 0) {
      rememberCurrentPassage(memory, rowInfo[row - 1]?.passage?.id ?? '');
    }
    sheetScroll();
  };
  const commitCurrentRowNowRef = useRef(commitCurrentRowNow);
  commitCurrentRowNowRef.current = commitCurrentRowNow;

  const scheduleCommitCurrentRow = useMemo(
    () => debounce(() => commitCurrentRowNowRef.current(), 100),
    []
  );

  useEffect(
    () => () => scheduleCommitCurrentRow.clear(),
    [scheduleCommitCurrentRow]
  );

  const setCurrentRow = (row: number) => {
    if (row > rowInfo.length) return;
    if (row === currentRowRef.current && row === currentRow) return;
    currentRowRef.current = row;
    startRowRef.current = row;
    const j = selectColRef.current;
    setAbsSel({ startI: row, endI: row, startJ: j, endJ: j });
    scheduleCommitCurrentRow.clear();
    commitCurrentRowNow();
  };

  const handleSelect = (loc: DataSheet.Selection) => {
    const sheetEnd = loc.end?.i;
    if (sheetEnd === undefined) return;

    // Sheet index 0 is the header: paste-target at the top, scroll-up when windowed.
    if (sheetEnd === 0) {
      if (windowFirstRef.current > 1) {
        const rh = rowHeightRef.current;
        const scroller = scrollRef.current;
        if (scroller && rh) {
          const target = sheetClip(scroller);
          target.scrollTop = Math.max(
            0,
            target.scrollTop - rh * overscanOf(pageSizeRef.current)
          );
        }
        return;
      }
      // True header (windowFirst === 1): whole-plan paste via parsePaste.
      if (currentRowRef.current === 0 && startRowRef.current === 0) return;
      currentRowRef.current = 0;
      startRowRef.current = 0;
      const j = loc.end?.j ?? 0;
      selectColRef.current = j;
      setAbsSel({ startI: 0, endI: 0, startJ: j, endJ: j });
      setCurrentRowx((prev) => (prev === 0 ? prev : 0));
      scheduleCommitCurrentRow();
      return;
    }

    const absLocEnd = sheetToAbs(sheetEnd);
    const absLocStart = sheetToAbs(loc.start?.i ?? sheetEnd);
    if (
      absLocEnd < windowFirstRef.current ||
      absLocEnd >= windowLastRef.current
    ) {
      return;
    }
    const endJ = loc.end?.j ?? 0;
    const startJ = loc.start?.j ?? endJ;
    const isPoint = loc.start?.i === loc.end?.i && startJ === endJ;
    // DataSheet `end` is the moving cell (drag / shift). Keep our original
    // click as the range anchor — after we put focus in selected.start,
    // loc.start is no longer the anchor.
    const freezeAnchor =
      !isPoint &&
      startRowRef.current >= 1 &&
      startRowRef.current !== currentRowRef.current;
    const absFocus = absLocEnd;
    const absAnchor = isPoint
      ? absFocus
      : freezeAnchor
        ? startRowRef.current
        : absLocStart;
    const focusJ = endJ;
    const sameAnchor =
      absFocus === currentRowRef.current && absAnchor === startRowRef.current;
    currentRowRef.current = absFocus;
    startRowRef.current = absAnchor;
    selectColRef.current = focusJ;
    setAbsSel((prev) => {
      const next = {
        startI: absAnchor,
        endI: absFocus,
        startJ: freezeAnchor ? prev.startJ : startJ,
        endJ: focusJ,
      };
      return prev.startI === next.startI &&
        prev.endI === next.endI &&
        prev.startJ === next.startJ &&
        prev.endJ === next.endJ
        ? prev
        : next;
    });
    if (sameAnchor) return;
    setCurrentRowx((prev) => (prev === absFocus ? prev : absFocus));
    if (isPoint) queueMicrotask(() => sheetScrollRef.current());
    scheduleCommitCurrentRow();
  };

  const handleRowsPerPage = useMemo(
    () => debounce(() => syncViewportRef.current(false), 100),
    []
  );

  const scrolled = useMemo(
    () =>
      debounce(() => {
        if (ignoreScrollCurTopRef.current) return;
        const rh = rowHeightRef.current;
        const scroller = scrollRef.current;
        if (!rh || !scroller) return;
        const table = sheetRef.current?.querySelector(
          'table.data-grid'
        ) as HTMLTableElement | null;
        const firstData = table?.rows?.[1];
        const clip = sheetClip(scroller);
        const { top: clipTop } = visibleClip(scroller, 0, window.innerHeight);
        // Padding and WarningDiv sit above the grid; measure the first mounted
        // data row against the visible clip (inner scroller or AppLayout).
        const next = firstData
          ? curTopFromViewport(
              clipTop,
              firstData.getBoundingClientRect().top,
              windowFirstRef.current,
              rh
            )
          : Math.max(1, Math.floor(clip.scrollTop / rh));
        setCurTop((t) => (t === next ? t : next));
      }, 100),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    syncViewport();
    const scroller = scrollRef.current;
    window.addEventListener('resize', handleRowsPerPage);
    const onScroll = (e: Event) => {
      if (!isSheetScrollTarget(scrollRef.current, e.target)) return;
      scrolled();
    };
    // Capture: AppLayout (or any ancestor) can be the element that actually scrolls.
    window.addEventListener('scroll', onScroll, true);
    const ro =
      typeof ResizeObserver !== 'undefined' && scroller
        ? new ResizeObserver(() => handleRowsPerPage())
        : undefined;
    if (scroller && ro) ro.observe(scroller);
    const onDown = () => sheetScrollRef.current();
    subscribe(DOWN_ARROW, onDown);

    return () => {
      unsubscribe(DOWN_ARROW);
      window.removeEventListener('resize', handleRowsPerPage);
      window.removeEventListener('scroll', onScroll, true);
      ro?.disconnect();
      handleRowsPerPage.clear();
      scrolled.clear();
      window.clearTimeout(ignoreScrollTimerRef.current);
      window.cancelAnimationFrame(sheetScrollRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { first: windowFirst, last: windowLast } = sheetWindow(
    curTop,
    pageSize,
    data.length
  );
  windowFirstRef.current = windowFirst;
  windowLastRef.current = windowLast;

  const visibleData = useMemo(() => {
    if (data.length <= 1) return data as any[][];
    return [data[0], ...data.slice(windowFirst, windowLast)] as any[][];
  }, [data, windowFirst, windowLast]);

  // Measure after rows exist and when rowHeight first locks (spacers appear).
  useLayoutEffect(() => {
    if (data.length <= 1) return;
    syncViewport(rowHeightRef.current === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length, rowHeight]);

  const topPad = rowHeight > 0 ? (windowFirst - 1) * rowHeight : 0;
  const bottomPad =
    rowHeight > 0 ? Math.max(0, data.length - windowLast) * rowHeight : 0;

  // Programmatic window moves grow/shrink topPad; keep scrollTop in lockstep
  // so the spacer never sits in the viewport (gap above the grid).
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const rh = rowHeightRef.current;
    const prev = prevWindowFirstRef.current;
    prevWindowFirstRef.current = windowFirst;
    if (!scroller || !rh || prev === windowFirst) return;
    if (!ignoreScrollCurTopRef.current) return;
    const clip = sheetClip(scroller);
    const pad = topPadElRef.current;
    const floor = scrollTopFloorForPad(
      clip.scrollTop,
      clip.getBoundingClientRect().top,
      pad?.getBoundingClientRect().bottom ?? 0,
      pad?.offsetHeight ?? 0
    );
    clip.scrollTop = Math.max(
      floor,
      clip.scrollTop + (windowFirst - prev) * rh
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowFirst, topPad]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const clearActive = useCallback(() => setActive(-1), []);
  const sheetCurrentI = useMemo(
    () => sheetCurrentIndex(currentRow, windowFirst, windowLast),
    [currentRow, windowFirst, windowLast]
  );
  const rowCtx = useMemo(
    () => ({ currentRow, activeRow: active, sheetCurrentI, clearActive }),
    [currentRow, active, sheetCurrentI, clearActive]
  );

  const selected = useMemo(
    (): DataSheet.Selection | null =>
      visibleSheetSelection({
        startI: absSel.startI,
        endI: absSel.endI,
        startJ: absSel.startJ,
        endJ: absSel.endJ,
        windowFirst,
        windowLast,
      }),
    [absSel, windowFirst, windowLast]
  );

  return {
    sheetToAbs,
    setCurrentRow,
    handleSelect,
    visibleData,
    topPad,
    bottomPad,
    selected,
    rowCtx,
  };
}
