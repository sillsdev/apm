import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Measures the unused horizontal space ("slack") between the end of a
 * wrapped / line-clamped title's text and the inline-end edge of its box.
 *
 * A single-line title shrink-wraps its text in a flex row, so its slack is 0.
 * Once the title wraps, its box fills the available width and the widest line
 * may still leave empty space before whatever follows it. Callers can shift
 * the trailing element back by `titleSlack` (e.g. `insetInlineStart:
 * -titleSlack` on a `position: relative` wrapper) so it sits right after the
 * text instead of at the far edge of the row.
 *
 * - The slack is the smallest gap across all *visible* lines, so the shifted
 *   element never overlaps the longest line. Lines hidden by line clamping
 *   are ignored.
 * - When the text is clamped, the browser draws an ellipsis that is not part
 *   of the text's client rects, so its width is subtracted from the last line
 *   (measured from its truncated fragment, not the full hidden line).
 * - Respects `direction: rtl` (slack is measured from the left edge).
 * - Re-measures when the title changes, the box resizes, or web fonts finish
 *   loading.
 *
 * @param title The rendered title text; changing it triggers a re-measure.
 * @param enabled When false, nothing is measured and `titleSlack` is 0.
 * @returns `titleRef` to attach to the title element, and `titleSlack` in px
 *   (never negative).
 */
export function useTitleSlack(title: string, enabled: boolean) {
  const titleRef = useRef<HTMLParagraphElement>(null);
  const [titleSlack, setTitleSlack] = useState(0);

  useLayoutEffect(() => {
    const box = titleRef.current;
    if (!enabled || !box) return;
    const range = document.createRange();
    range.selectNodeContents(box);
    const canvas = document.createElement('canvas').getContext('2d');
    // Guards the async font callbacks from firing after cleanup.
    let connected = true;
    const measure = () => {
      if (!connected) return;
      const bounds = box.getBoundingClientRect();
      // Keep only line fragments that are visible inside the (clamped) box.
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.top < bounds.bottom && rect.bottom > bounds.top
      );
      if (!rects.length) return setTitleSlack(0);
      const style = getComputedStyle(box);
      const rtl = style.direction === 'rtl';
      const slackAfter = (rect: DOMRect) =>
        rtl ? rect.left - bounds.left : bounds.right - rect.right;
      const clamped = box.scrollHeight > box.clientHeight;
      const lastTop = Math.max(...rects.map((rect) => rect.top));
      const onClampedLine = (rect: DOMRect) => clamped && rect.top === lastTop;
      let slack = Math.min(
        ...rects.filter((rect) => !onClampedLine(rect)).map(slackAfter)
      );
      // Clamped: when Chrome truncates the last visible line to fit the
      // ellipsis, it reports both the full line and the truncated part, so use
      // the shortest fragment and leave room for the ellipsis after it.
      if (clamped && canvas) {
        canvas.font = style.font;
        slack = Math.min(
          slack,
          Math.max(...rects.filter(onClampedLine).map(slackAfter)) -
            canvas.measureText('…').width
        );
      }
      setTitleSlack(Math.max(0, slack));
    };

    measure();
    // flushSync applies the new offset in the same frame as the resize, so the
    // trailing element doesn't visibly lag behind the text.
    const observer = new ResizeObserver(() => flushSync(measure));
    observer.observe(box);
    document.fonts.ready.then(measure);
    document.fonts.addEventListener('loadingdone', measure);
    return () => {
      connected = false;
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', measure);
    };
  }, [title, enabled]);

  return { titleRef, titleSlack: enabled ? titleSlack : 0 };
}
