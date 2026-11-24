/** Prefer transcriber, then editor, then any todo row for this media id. */
export function pickTodoMediaRow<
  T extends { mediafile?: { id?: string }; role?: string },
>(rowData: T[], mediaId: string | undefined | null): T | undefined {
  if (!mediaId) return undefined;
  const asTranscriber = rowData.find(
    (r) => r.mediafile?.id === mediaId && r.role === 'transcriber'
  );
  if (asTranscriber) return asTranscriber;
  const asEditor = rowData.find(
    (r) => r.mediafile?.id === mediaId && r.role === 'editor'
  );
  if (asEditor) return asEditor;
  return rowData.find((r) => r.mediafile?.id === mediaId);
}
