import { describe, expect, it } from '@jest/globals';
import { cleanAsrTranscription } from './cleanAsrTranscription';

describe('cleanAsrTranscription', () => {
  it('returns empty for blank input', () => {
    expect(cleanAsrTranscription('   ')).toBe('');
  });

  it('strips timestamp prefixes without clipping a longer digit run', () => {
    expect(cleanAsrTranscription('0:01.200: hello 1:02.300: world')).toBe(
      'hello world'
    );
    expect(cleanAsrTranscription('12345678901:1.2: hi')).toBe(
      '12345678901:1.2: hi'
    );
  });
});
