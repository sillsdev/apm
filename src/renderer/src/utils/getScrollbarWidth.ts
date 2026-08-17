/** Measure the OS/browser vertical scrollbar width (0 if element not in DOM). */
export function measureScrollbarWidth(): number {
  if (typeof document === 'undefined' || !document.body) return 0;
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  // @ts-expect-error msOverflowStyle is IE-specific
  outer.style.msOverflowStyle = 'scrollbar';
  try {
    document.body.appendChild(outer);
    const inner = document.createElement('div');
    outer.appendChild(inner);
    return outer.offsetWidth - inner.offsetWidth;
  } finally {
    outer.parentNode?.removeChild(outer);
  }
}

/** True when the document has a vertical scrollbar. */
export function documentHasVerticalScrollbar(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.scrollHeight >
    document.documentElement.clientHeight
  );
}
