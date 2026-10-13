/** Split files by client-side size limit (MB). Used by MediaUploadContent.checkSizes. */
export const filterFilesBySizeLimit = (
  files: File[],
  sizeLimitMb: number
): { accepted: File[]; rejected: File[] } => {
  const maxBytes = sizeLimitMb * 1000000;
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (file.size <= maxBytes) {
      accepted.push(file);
    } else {
      rejected.push(file);
    }
  }
  return { accepted, rejected };
};

/** `{name} ({size}MB)` for each file, comma-separated. */
export function oversizedFileList(
  files: { name: string; size: number }[]
): string {
  return files
    .map((f) => `${f.name} (${(f.size / 1000000).toFixed(2)}MB)`)
    .join(', ');
}
