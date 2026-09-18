import {
  aeroProgressPercent,
  clipTranscription,
  formatSegmentTranscription,
  parseAeroTranscriptionPoll,
  transcriptionText,
  verseForSegment,
  verseFromLabel,
} from './aeroTranscriptionPoll';

const envelope = (overrides: Record<string, unknown> = {}) => ({
  task_id: 't1',
  state: 'PENDING',
  result: { items: [] },
  progress: { completed: 0, total: 1 },
  ...overrides,
});

describe('parseAeroTranscriptionPoll', () => {
  it('does not treat presence of result as done', () => {
    const parsed = parseAeroTranscriptionPoll(
      envelope({
        result: {
          items: [
            {
              clip: 'a.wav',
              state: 'PENDING',
              progress: { completed: 0, total: 2 },
              segments: [
                {
                  start: 0,
                  end: 12.5,
                  transcription: { sister_transcription: 'hi' },
                },
              ],
            },
          ],
        },
      })
    );
    expect(parsed.terminal).toBe(false);
    expect(parsed.failed).toBe(false);
    expect(parsed.clip?.clip).toBe('a.wav');
  });

  it('is terminal when the first clip has settled', () => {
    expect(
      parseAeroTranscriptionPoll(
        envelope({
          state: 'SUCCESS',
          result: {
            items: [{ clip: 'a.wav', state: 'PENDING', segments: [] }],
          },
        })
      ).terminal
    ).toBe(false);
    expect(
      parseAeroTranscriptionPoll(
        envelope({
          state: 'PENDING',
          result: {
            items: [{ clip: 'a.wav', state: 'SUCCESS', segments: [] }],
          },
        })
      ).terminal
    ).toBe(true);
    expect(
      parseAeroTranscriptionPoll(
        envelope({
          result: {
            items: [{ clip: 'a.wav', state: 'FAILURE', segments: [] }],
          },
        })
      ).failed
    ).toBe(true);
  });

  it('treats top-level FAILURE as clip failure even if the clip stays PENDING', () => {
    const parsed = parseAeroTranscriptionPoll(
      envelope({
        state: 'FAILURE',
        error: { message: 'job exploded' },
        result: {
          items: [{ clip: 'a.wav', state: 'PENDING', segments: [] }],
        },
      })
    );
    expect(parsed.failed).toBe(true);
    expect(parsed.terminal).toBe(true);
    expect(parsed.error).toEqual({ message: 'job exploded' });
    expect(
      parseAeroTranscriptionPoll(envelope({ state: 'FAILURE' })).failed
    ).toBe(true);
  });

  it('reads progress from the first clip, not the top level', () => {
    const parsed = parseAeroTranscriptionPoll(
      envelope({
        progress: { completed: 0, total: 1 },
        result: {
          items: [
            {
              clip: 'a.wav',
              state: 'PENDING',
              progress: { completed: 1, total: 3 },
              segments: [],
            },
          ],
        },
      })
    );
    expect(parsed.progress).toEqual({ completed: 1, total: 3 });
    expect(aeroProgressPercent(parsed.progress)).toBeCloseTo(100 / 3);
  });

  it('ignores clips after the first', () => {
    const parsed = parseAeroTranscriptionPoll(
      envelope({
        result: {
          items: [
            {
              clip: 'a.wav',
              state: 'SUCCESS',
              progress: { completed: 2, total: 2 },
              segments: [
                {
                  start: 0,
                  end: 1,
                  transcription: { sister_transcription: 'done' },
                },
              ],
            },
            {
              clip: 'b.wav',
              state: 'PENDING',
              progress: { completed: 0, total: 1 },
              segments: [],
            },
          ],
        },
      })
    );
    expect(parsed.terminal).toBe(true);
    expect(parsed.clip?.clip).toBe('a.wav');
    expect(parsed.progress).toEqual({ completed: 2, total: 2 });
    expect(
      transcriptionText(parsed.clip?.segments[0]?.transcription, false)
    ).toBe('done');
  });

  it('does not treat a transcription string as a finished job', () => {
    const parsed = parseAeroTranscriptionPoll({ transcription: 'hello' });
    expect(parsed.terminal).toBe(false);
    expect(parsed.clip).toBeUndefined();
  });

  it('parses a finished unsplit clip as one segment', () => {
    const parsed = parseAeroTranscriptionPoll(
      envelope({
        state: 'SUCCESS',
        progress: { completed: 1, total: 1 },
        result: {
          items: [
            {
              clip: 'a.wav',
              state: 'SUCCESS',
              segments: [
                {
                  start: 0,
                  end: 12.5,
                  transcription: { sister_transcription: 'whole file' },
                },
              ],
              progress: { completed: 1, total: 1 },
            },
          ],
        },
      })
    );
    expect(parsed.terminal).toBe(true);
    expect(parsed.clip?.segments).toHaveLength(1);
    expect(
      transcriptionText(parsed.clip?.segments[0]?.transcription, false)
    ).toBe('whole file');
  });

  it('keeps every segment on a finished clip', () => {
    const parsed = parseAeroTranscriptionPoll(
      envelope({
        result: {
          items: [
            {
              clip: 'a.wav',
              state: 'SUCCESS',
              segments: [
                {
                  start: 0,
                  end: 5,
                  transcription: { sister_transcription: 'one' },
                },
                {
                  start: 5,
                  end: 10,
                  transcription: { sister_transcription: 'two' },
                },
              ],
            },
          ],
        },
      })
    );
    expect(
      parsed.clip?.segments.map((s) =>
        transcriptionText(s.transcription, false)
      )
    ).toEqual(['one', 'two']);
  });
});

describe('transcriptionText', () => {
  it('prefers phonetic_transcription when phonetic is true', () => {
    expect(
      transcriptionText(
        { sister_transcription: 'sister', phonetic_transcription: 'ipa' },
        true
      )
    ).toBe('ipa');
  });
});

describe('verse matching', () => {
  it('matches a verse by start time, else by index', () => {
    const verses = [
      { start: 0, verse: '1' },
      { start: 12.5, verse: '2' },
    ];
    expect(verseForSegment(12.5, 0, verses)).toBe('2');
    expect(verseForSegment(99, 0, verses)).toBe('1');
    expect(verseFromLabel('1:3')).toBe('3');
    expect(formatSegmentTranscription('hi', '3')).toBe('\\v 3 hi');
  });
});

describe('clipTranscription', () => {
  it('joins successful clip segments into one string', () => {
    expect(
      clipTranscription(
        {
          clip: 'a.wav',
          state: 'SUCCESS',
          segments: [
            {
              start: 0,
              end: 5,
              transcription: { sister_transcription: 'one' },
            },
            {
              start: 5,
              end: 10,
              transcription: { sister_transcription: 'two' },
            },
          ],
        },
        false,
        []
      )
    ).toBe('one two');
  });

  it('skips verses already in the transcription', () => {
    expect(
      clipTranscription(
        {
          clip: 'a.wav',
          state: 'SUCCESS',
          segments: [
            {
              start: 0,
              end: 5,
              transcription: { sister_transcription: 'one' },
            },
            {
              start: 5,
              end: 10,
              transcription: { sister_transcription: 'two' },
            },
          ],
        },
        false,
        [
          { start: 0, verse: '1' },
          { start: 5, verse: '2' },
        ],
        ['1']
      )
    ).toBe('\\v 2 two');
  });
});
