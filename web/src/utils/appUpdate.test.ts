import { describe, it, expect } from '@jest/globals';
import {
  formatReleaseDate,
  isNewerVersion,
  parseLatestVersion,
} from './appUpdate';

describe('isNewerVersion', () => {
  it('is true when the server version is higher', () => {
    expect(isNewerVersion('4.7.3', '4.7.2')).toBe(true);
    expect(isNewerVersion('4.8.0', '4.7.9')).toBe(true);
    expect(isNewerVersion('5.0.0', '4.99.99')).toBe(true);
    expect(isNewerVersion('4.7.10', '4.7.9')).toBe(true);
  });

  it('is false when equal or older (never offer a downgrade)', () => {
    expect(isNewerVersion('4.7.2', '4.7.2')).toBe(false);
    expect(isNewerVersion('4.7.1', '4.7.2')).toBe(false);
    expect(isNewerVersion('4.7.9', '4.7.10')).toBe(false);
  });

  it('compares only the first token', () => {
    expect(isNewerVersion('4.7.3 beta', '4.7.2')).toBe(true);
    expect(isNewerVersion('4.7.2 beta', '4.7.2')).toBe(false);
  });

  it('treats missing parts as zero', () => {
    expect(isNewerVersion('4.8', '4.7.2')).toBe(true);
    expect(isNewerVersion('4.7', '4.7.0')).toBe(false);
  });

  it('is false for empty input', () => {
    expect(isNewerVersion('', '4.7.2')).toBe(false);
    expect(isNewerVersion('4.7.3', '')).toBe(false);
  });
});

describe('parseLatestVersion', () => {
  it('appends Z to a zone-less UTC timestamp', () => {
    expect(
      parseLatestVersion({
        desktopVersion: '4.7.3',
        dateUpdated: '2026-11-13T03:08:00',
      })
    ).toEqual({ desktopVersion: '4.7.3', dateUpdated: '2026-11-13T03:08:00Z' });
  });

  it('keeps a timestamp that already has a zone', () => {
    expect(
      parseLatestVersion({
        desktopVersion: '4.7.3',
        dateUpdated: '2026-11-13T03:08:00Z',
      })?.dateUpdated
    ).toBe('2026-11-13T03:08:00Z');
  });

  it('tolerates a missing dateUpdated', () => {
    expect(parseLatestVersion({ desktopVersion: '4.7.3' })).toEqual({
      desktopVersion: '4.7.3',
      dateUpdated: '',
    });
  });

  it('rejects responses without a version', () => {
    expect(parseLatestVersion(undefined)).toBeNull();
    expect(parseLatestVersion('oops')).toBeNull();
    expect(parseLatestVersion({ desktopVersion: '' })).toBeNull();
    expect(parseLatestVersion({ desktopVersion: 4 })).toBeNull();
  });
});

describe('formatReleaseDate', () => {
  it('formats a valid date', () => {
    expect(formatReleaseDate('2026-11-13T12:00:00Z', 'en')).toMatch(/2026/);
  });

  it('returns empty for missing or invalid dates', () => {
    expect(formatReleaseDate('', 'en')).toBe('');
    expect(formatReleaseDate('not a date', 'en')).toBe('');
  });
});
