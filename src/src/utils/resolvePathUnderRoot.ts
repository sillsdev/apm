import path from 'path-browserify';

/** Windows drive path (e.g. C:\ or D:/foo) — not POSIX-absolute in path-browserify. */
function segmentLooksAbsolute(seg: string): boolean {
  if (path.isAbsolute(seg)) {
    return true;
  }
  if (/^[a-zA-Z]:/.test(seg)) {
    return true;
  }
  if (seg.startsWith('\\\\')) {
    return true;
  }
  return false;
}

/** Normalize for prefix comparison only (forward slashes, collapse duplicate slashes). */
function comparablePath(p: string): string {
  const unified = p.replace(/\\/g, '/');
  const normalized = path.normalize(unified);
  return normalized.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

/**
 * Resolves `rootDir` + `segments` to an absolute path only if the result stays
 * inside `rootDir` (no `..` escape, no absolute segments, no null bytes).
 *
 * Uses `path.join` + `path.normalize` only — never `path.resolve` / `path.relative`,
 * because path-browserify calls `process.cwd()` when paths are not POSIX-absolute,
 * which breaks Windows roots like `C:\...` in the Electron renderer.
 */
export function resolvePathUnderRoot(
  rootDir: string,
  ...segments: string[]
): string | null {
  if (!rootDir) {
    return null;
  }
  for (const seg of segments) {
    if (seg == null || seg.includes('\0')) {
      return null;
    }
    if (segmentLooksAbsolute(seg)) {
      return null;
    }
  }
  const filtered = segments.filter((s) => s !== '');
  const resolved = path.normalize(path.join(rootDir, ...filtered));

  const baseComp = comparablePath(rootDir);
  const fullComp = comparablePath(resolved);
  const prefix = baseComp.endsWith('/') ? baseComp : `${baseComp}/`;
  if (fullComp !== baseComp && !fullComp.startsWith(prefix)) {
    return null;
  }
  return resolved;
}
