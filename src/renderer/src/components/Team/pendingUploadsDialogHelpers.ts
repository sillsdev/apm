/** Show "Retry all" only when more than one pending upload exists (TT-7344). */
export function shouldShowRetryAll(count: number): boolean {
  return count > 1;
}

/** Determinate retry progress label for completed/total uploads (TT-7364). */
export function retryProgressLabel(
  template: string,
  completed: number,
  total: number
): string {
  return template
    .replace('{0}', String(completed))
    .replace('{1}', String(total));
}
