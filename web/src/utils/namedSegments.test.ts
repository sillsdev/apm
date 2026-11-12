import { hasTranscriptionTask, NamedRegions } from './namedSegments';

describe('hasTranscriptionTask', () => {
  it('is false for missing or empty segments', () => {
    expect(hasTranscriptionTask(undefined)).toBe(false);
    expect(hasTranscriptionTask('')).toBe(false);
    expect(hasTranscriptionTask('{}')).toBe(false);
    expect(hasTranscriptionTask('[]')).toBe(false);
  });

  it('is false when only other named regions are present', () => {
    const segments = JSON.stringify([
      { name: NamedRegions.Transcription, regionInfo: '{"regions":"[]"}' },
    ]);
    expect(hasTranscriptionTask(segments)).toBe(false);
  });

  it('is true when a TRTask region is present', () => {
    const segments = JSON.stringify([
      { name: NamedRegions.TRTask, regionInfo: 'task-123' },
    ]);
    expect(hasTranscriptionTask(segments)).toBe(true);
  });

  it('is false for old-style segments, which never hold a task', () => {
    expect(hasTranscriptionTask('{"regions":"[]"}')).toBe(false);
  });
});
