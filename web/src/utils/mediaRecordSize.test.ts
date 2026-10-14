import { convertToWav } from './wav';
import {
  CHUNK_HEADER_BYTES,
  CHUNK_SIZE_OFFSET,
  FMT_ID,
  OPUS_ESTIMATE_HEADROOM,
  OPUS_MONO_BYTES_PER_SECOND,
  RECORD_FLOAT32_BYTES_PER_SECOND,
  RIFF_HEADER_BYTES,
  RIFF_ID,
  WAVE_ID,
  estimatedLiveWavBytes,
  estimatedOpusBytes,
  wavChannelCount,
} from './mediaRecordSize';
import { wavBlob } from './__tests__/wavBlob';

/** The WAV the recorder and editor hand over: float32, as audioBufferToWavBlob writes it. */
const editorWav = (channels: 1 | 2, sampleRate: number) =>
  convertToWav(
    new Float32Array(8),
    channels === 2 ? new Float32Array(8) : null,
    { isFloat: true, numChannels: channels, sampleRate }
  );

describe('estimatedOpusBytes', () => {
  it('prices mono at 64 kbps plus headroom', () => {
    expect(estimatedOpusBytes(60, 1)).toBe(
      60 * OPUS_MONO_BYTES_PER_SECOND * OPUS_ESTIMATE_HEADROOM
    );
    expect(estimatedOpusBytes(60, 1)).toBeCloseTo(504_000);
  });

  it('keeps a 57 minute mono take under a 30 MB limit', () => {
    const estimated = estimatedOpusBytes(57 * 60, 1);
    expect(estimated / 1_000_000).toBeCloseTo(28.73, 2);
    expect(estimated).toBeLessThan(30 * 1_000_000);
  });

  it('prices stereo at 96 kbps, 1.5 times mono', () => {
    expect(estimatedOpusBytes(60, 2)).toBeCloseTo(
      estimatedOpusBytes(60, 1) * 1.5
    );
  });

  it('encodes more than two channels as stereo', () => {
    expect(estimatedOpusBytes(60, 6)).toBe(estimatedOpusBytes(60, 2));
  });

  it('is zero for no audio', () => {
    expect(estimatedOpusBytes(0, 1)).toBe(0);
    expect(estimatedOpusBytes(-1, 2)).toBe(0);
  });
});

describe('estimatedLiveWavBytes', () => {
  it('prices a live take at the float32 file the recorder will write', () => {
    expect(estimatedLiveWavBytes(10, 1)).toBe(
      10 * RECORD_FLOAT32_BYTES_PER_SECOND
    );
    expect(estimatedLiveWavBytes(10, 2)).toBe(
      2 * 10 * RECORD_FLOAT32_BYTES_PER_SECOND
    );
    expect(estimatedLiveWavBytes(0, 1)).toBe(0);
  });
});

describe('wavChannelCount', () => {
  it('reads a mono recorder take', async () => {
    expect(await wavChannelCount(await editorWav(1, 48_000))).toBe(1);
  });

  it('reads a stereo 44.1 kHz WAV from an edited mp3', async () => {
    expect(await wavChannelCount(await editorWav(2, 44_100))).toBe(2);
  });

  it('counts a file that is not a WAV as mono', async () => {
    expect(
      await wavChannelCount(
        new Blob([new Uint8Array(64)], { type: 'audio/mpeg' })
      )
    ).toBe(1);
    expect(await wavChannelCount(new Blob())).toBe(1);
  });

  it('reads fmt after a JUNK chunk instead of at a fixed offset', async () => {
    expect(await wavChannelCount(wavBlob({ junk: 4, channels: 2 }))).toBe(2);
    expect(await wavChannelCount(wavBlob({ junk: 5, channels: 2 }))).toBe(2);
  });

  it('counts truncated and malformed headers as mono', async () => {
    const file = (bytes: Uint8Array<ArrayBuffer>) =>
      wavChannelCount(new Blob([bytes], { type: 'audio/wav' }));
    expect(await file(new Uint8Array(RIFF_HEADER_BYTES - 1))).toBe(1);

    const notWave = new Uint8Array(RIFF_HEADER_BYTES);
    new DataView(notWave.buffer).setUint32(0, RIFF_ID, false);
    expect(await file(notWave)).toBe(1);

    const overrun = new Uint8Array(RIFF_HEADER_BYTES + CHUNK_HEADER_BYTES);
    const view = new DataView(overrun.buffer);
    view.setUint32(0, RIFF_ID, false);
    view.setUint32(8, WAVE_ID, false);
    view.setUint32(RIFF_HEADER_BYTES, FMT_ID, false);
    view.setUint32(RIFF_HEADER_BYTES + CHUNK_SIZE_OFFSET, 100, true);
    expect(await file(overrun)).toBe(1);

    expect(await wavChannelCount(wavBlob({ fmtSize: 4, channels: 2 }))).toBe(1);
    expect(await wavChannelCount(wavBlob({ channels: 0 }))).toBe(1);
  });
});
