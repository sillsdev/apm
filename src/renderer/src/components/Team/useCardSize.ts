import { useContext, useEffect, useRef } from 'react';
import { CardSizeContext } from './CardSize';

// Default card height
export const minCardHeight = 176;

// Adapt cards' height to their tallest card
export const useCardHeight = () =>
  Math.max(useContext(CardSizeContext).tallest, minCardHeight);

export const useMeasureCardHeight = (id: string) => {
  const { reportHeight } = useContext(CardSizeContext);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const rows = Array.from(content.children) as HTMLElement[];
      const gap = parseFloat(getComputedStyle(content).rowGap) || 0;
      const host = content.parentElement;
      const hostStyle = host && getComputedStyle(host);
      const padding = hostStyle
        ? (parseFloat(hostStyle.paddingTop) || 0) +
          (parseFloat(hostStyle.paddingBottom) || 0)
        : 0;
      const needed =
        rows.reduce((height, row) => height + row.offsetHeight, 0) +
        gap * Math.max(rows.length - 1, 0) +
        padding;
      reportHeight(id, Math.ceil(needed));
    };

    const sizes = new ResizeObserver(measure);
    const watchRows = () => {
      sizes.disconnect();
      Array.from(content.children).forEach((row) => sizes.observe(row));
      measure();
    };
    // Rows can come and go, so re-aim the size observer when the set changes.
    const rows = new MutationObserver(watchRows);
    rows.observe(content, { childList: true });
    watchRows();

    return () => {
      rows.disconnect();
      sizes.disconnect();
      reportHeight(id, null);
    };
  }, [id, reportHeight]);

  return contentRef;
};
