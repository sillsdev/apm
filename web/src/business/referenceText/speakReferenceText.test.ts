import { speakReferenceText } from './speakReferenceText';
import { ReferenceText } from './referenceText';

class FakeUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  lang = '';
  onboundary?: (e: { charIndex: number }) => void;
  onend?: () => void;
  onerror?: (e: { error: string }) => void;
  constructor(text: string) {
    this.text = text;
  }
}

const david = {
  lang: 'en-US',
  name: 'David',
  voiceURI: 'David',
  localService: true,
  default: true,
} as SpeechSynthesisVoice;

let spoken: FakeUtterance[];
let voices: SpeechSynthesisVoice[];
const synth = {
  getVoices: () => voices,
  speak: (u: FakeUtterance) => spoken.push(u),
  cancel: jest.fn(() => {
    const u = spoken[spoken.length - 1];
    u?.onerror?.({ error: 'interrupted' });
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const bsb = {
  id: 'BSB',
  name: 'Berean Standard Bible',
  englishName: 'Berean Standard Bible',
  language: 'eng',
  textDirection: 'ltr',
  license: '',
  books: 'JHN',
} as ReferenceText;
const arabic = { ...bsb, id: 'arb_vdv', language: 'arb' } as ReferenceText;

// Lets the voice lookup resolve and the first utterance be queued.
const settle = () => new Promise((r) => setTimeout(r, 0));

// Two sentences longer than one chunk together, so two utterances
const text = `${'a'.repeat(150)}. ${'b'.repeat(150)}.`;

beforeEach(() => {
  spoken = [];
  voices = [david];
  synth.cancel.mockClear();
  Object.assign(globalThis, {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: FakeUtterance,
  });
});

describe('speakReferenceText', () => {
  it('reports noVoice when no voice speaks the language', async () => {
    const speaking = speakReferenceText(arabic, text);
    await expect(speaking.done).resolves.toBe('noVoice');
    expect(spoken).toHaveLength(0);
  });

  it('reports noVoice when the device has no speech at all', async () => {
    Object.assign(globalThis, { speechSynthesis: undefined });
    await expect(speakReferenceText(bsb, text).done).resolves.toBe('noVoice');
  });

  it('speaks each chunk in turn with the chosen voice', async () => {
    const speaking = speakReferenceText(bsb, text);
    await settle();
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice).toBe(david);
    expect(spoken[0].lang).toBe('en-US');
    spoken[0].onend?.();
    expect(spoken).toHaveLength(2);
    spoken[1].onend?.();
    await expect(speaking.done).resolves.toBe('ended');
    expect(spoken.map((u) => u.text).join('')).toBe(text);
  });

  it('reports progress from word boundaries and chunk ends', async () => {
    const progress = jest.fn();
    speakReferenceText(bsb, text, progress);
    await settle();
    const first = spoken[0].text.length;
    spoken[0].onboundary?.({ charIndex: 76 });
    expect(progress).toHaveBeenLastCalledWith(
      Math.floor((76 / text.length) * 100)
    );
    spoken[0].onend?.();
    expect(progress).toHaveBeenLastCalledWith(
      Math.floor((first / text.length) * 100)
    );
    spoken[1].onend?.();
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it('stops without speaking further chunks', async () => {
    const speaking = speakReferenceText(bsb, text);
    await settle();
    speaking.stop();
    await expect(speaking.done).resolves.toBe('stopped');
    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken).toHaveLength(1);
  });

  it('stops before a voice is found', async () => {
    const speaking = speakReferenceText(bsb, text);
    speaking.stop();
    await expect(speaking.done).resolves.toBe('stopped');
    await settle();
    expect(spoken).toHaveLength(0);
  });

  it('reports an error the voice raises', async () => {
    const speaking = speakReferenceText(bsb, text);
    await settle();
    spoken[0].onerror?.({ error: 'network' });
    await expect(speaking.done).resolves.toBe('error');
    expect(spoken).toHaveLength(1);
  });

  it('stops the passage already speaking when another starts', async () => {
    const first = speakReferenceText(bsb, text);
    await settle();
    const second = speakReferenceText(bsb, 'Another passage.');
    await expect(first.done).resolves.toBe('stopped');
    await settle();
    spoken[spoken.length - 1].onend?.();
    await expect(second.done).resolves.toBe('ended');
  });
});
