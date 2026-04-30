import path from 'path-browserify';
import { resolvePathUnderRoot } from './resolvePathUnderRoot';

describe('resolvePathUnderRoot', () => {
  const root = '/safe/wrapper';

  it('returns resolved path for normal nested segments', () => {
    expect(resolvePathUnderRoot(root, 'text', 'metadata.json')).toBe(
      path.resolve(root, 'text', 'metadata.json')
    );
    expect(resolvePathUnderRoot(root, 'audio', 'ingredients', 'MAT.usfm')).toBe(
      path.resolve(root, 'audio', 'ingredients', 'MAT.usfm')
    );
  });

  it('returns path for wrapper.json under root', () => {
    expect(resolvePathUnderRoot(root, 'wrapper.json')).toBe(
      path.resolve(root, 'wrapper.json')
    );
  });

  it('returns null when a segment is absolute', () => {
    expect(resolvePathUnderRoot(root, '/etc', 'passwd')).toBeNull();
    expect(resolvePathUnderRoot(root, 'text', '/tmp/x')).toBeNull();
  });

  it('returns null when traversal escapes root', () => {
    expect(resolvePathUnderRoot(root, '..', 'outside')).toBeNull();
    expect(resolvePathUnderRoot(root, 'text', '..', '..', 'etc')).toBeNull();
    expect(resolvePathUnderRoot(root, 'a', 'b', '..', '..', '..', 'escape')).toBeNull();
  });

  it('returns null for empty root', () => {
    expect(resolvePathUnderRoot('', 'a')).toBeNull();
  });

  it('returns null when a segment contains a null byte', () => {
    expect(resolvePathUnderRoot(root, 'a\0b')).toBeNull();
  });

  it('allows single dot segments that stay inside', () => {
    const r = resolvePathUnderRoot(root, 'text', '.', 'file.usfm');
    expect(r).toBe(path.resolve(root, 'text', 'file.usfm'));
  });

  it('normalizes redundant separators inside safe paths', () => {
    const r = resolvePathUnderRoot(root, 'text/sub', '../sub/file.usfm');
    expect(r).toBe(path.normalize(path.join(root, 'text/sub/file.usfm')));
  });

  it('works with Windows-style root (no process.cwd)', () => {
    const winRoot = 'D:\\burritos\\import';
    const r = resolvePathUnderRoot(winRoot, 'audio', 'metadata.json');
    expect(r).not.toBeNull();
    expect(r).toBe(path.normalize(path.join(winRoot, 'audio', 'metadata.json')));
  });
});
