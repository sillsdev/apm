import { MB, mb } from './mb';

/** Split files by client-side size limit (MB). Used by MediaUploadContent.checkSizes. */
export const filterFilesBySizeLimit = (
  files: File[],
  sizeLimitMb: number
): { accepted: File[]; rejected: File[] } => {
  const maxBytes = sizeLimitMb * MB;
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
  return files.map((f) => `${f.name} (${mb(f.size)})`).join(', ');
}
