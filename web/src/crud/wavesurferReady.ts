/** True when this 'ready' is not the loadBlob we just kicked off. */
export function shouldIgnorePeaksReady(
  blobLoadToken: number | undefined,
  loadGeneration: number
): boolean {
  return blobLoadToken !== loadGeneration;
}
