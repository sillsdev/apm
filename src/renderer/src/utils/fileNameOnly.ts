// Strip any directory prefix (posix or windows) from a path, leaving the
// file name with its extension.
export function fileNameOnly(path?: string | null) {
  return (path ?? '').split(/[\/]/).pop() ?? '';
}
