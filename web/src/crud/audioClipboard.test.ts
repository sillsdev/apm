import { pasteSpan, sliceAudioBuffer } from './audioClipboard';

function fakeBuffer(channels: number[][], sampleRate = 10): AudioBuffer {
  const data = channels.map((channel) => Float32Array.from(channel));
  return {
    numberOfChannels: data.length,
    length: data[0]?.length ?? 0,
    sampleRate,
    duration: (data[0]?.length ?? 0) / sampleRate,
    getChannelData: (index: number) => data[index],
  } as AudioBuffer;
}

function createBuffer(
  numberOfChannels: number,
  length: number,
  sampleRate: number
): AudioBuffer {
  const data = Array.from(
    { length: numberOfChannels },
    () => new Float32Array(length)
  );
  return {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (index: number) => data[index],
  } as AudioBuffer;
}

describe('sliceAudioBuffer', () => {
  const source = fakeBuffer([
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
  ]);

  it('copies the overlapping samples from every channel', () => {
    const sliced = sliceAudioBuffer(source, 0.2, 0.4, createBuffer);
    expect(sliced).toBeDefined();
    expect(Array.from(sliced!.getChannelData(0))).toEqual([2, 3]);
    expect(Array.from(sliced!.getChannelData(1))).toEqual([7, 8]);
    expect(Array.from(source.getChannelData(0))).toEqual([0, 1, 2, 3, 4]);
  });

  it('clamps the end to the buffer', () => {
    const sliced = sliceAudioBuffer(source, 0.3, 5, createBuffer);
    expect(Array.from(sliced!.getChannelData(0))).toEqual([3, 4]);
  });

  it('returns undefined when the range does not overlap', () => {
    expect(sliceAudioBuffer(source, 2, 3, createBuffer)).toBeUndefined();
    expect(sliceAudioBuffer(source, 0.2, 0.2, createBuffer)).toBeUndefined();
  });
});

describe('pasteSpan', () => {
  const buffer = { length: 100, sampleRate: 10 };

  it('replaces a region that overlaps the buffer', () => {
    expect(pasteSpan({ start: 1, end: 2.5 }, 0, buffer)).toEqual({
      start: 1,
      end: 2.5,
    });
  });

  it('clamps a region that runs past the buffer', () => {
    expect(pasteSpan({ start: 8, end: 12 }, 0, buffer)).toEqual({
      start: 8,
      end: 10,
    });
  });

  it('inserts at the playhead when no region is selected', () => {
    expect(pasteSpan(undefined, 1.5, buffer)).toEqual({
      start: 1.5,
      end: 1.5,
    });
  });

  it('inserts at the playhead when the region does not overlap', () => {
    expect(pasteSpan({ start: 11, end: 12 }, 3, buffer)).toEqual({
      start: 3,
      end: 3,
    });
  });

  it('clamps the playhead into the buffer', () => {
    expect(pasteSpan(undefined, 40, buffer)).toEqual({ start: 10, end: 10 });
    expect(pasteSpan(undefined, Number.NaN, buffer)).toEqual({
      start: 0,
      end: 0,
    });
  });

  it('loads the clip as the whole waveform when there is no buffer', () => {
    expect(pasteSpan({ start: 1, end: 2 }, 1, undefined)).toEqual({
      start: 0,
      end: undefined,
    });
  });
});
