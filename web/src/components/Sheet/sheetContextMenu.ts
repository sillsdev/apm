export function shouldOpenSheetContextMenu(
  target: EventTarget | null
): boolean {
  if (!(target instanceof Element)) return true;
  return target.closest('input, textarea') == null;
}
