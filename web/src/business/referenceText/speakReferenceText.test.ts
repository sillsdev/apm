import { speakReferenceText, speakText } from './speakReferenceText';
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
let synth: {
  getVoices: () => SpeechSynthesisVoice[];
  speak: (u: FakeUtterance) => void;
  cancel: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
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

// First load waits until every voice is tagged and the list has been still.
const VOICES_QUIET_MS = 200;
const VOICES_WAIT_MS = 2000;
const settle = () => jest.advanceTimersByTimeAsync(VOICES_QUIET_MS);

// The fake synthesizer records `voiceschanged` so a test can publish a later list.
const changedVoices = () => {
  const listeners = new Set<() => void>();
  synth.addEventListener.mockImplementation((event: string, cb: () => void) => {
    if (event === 'voiceschanged') listeners.add(cb);
  });
  synth.removeEventListener.mockImplementation(
    (event: string, cb: () => void) => {
      if (event === 'voiceschanged') listeners.delete(cb);
    }
  );
  return () => listeners.forEach((cb) => cb());
};

// Two sentences longer than one chunk together, so two utterances
const text = `${'a'.repeat(150)}. ${'b'.repeat(150)}.`;

const google = {
  ...david,
  name: 'Google US English',
  voiceURI: 'Google US English',
  localService: false,
  default: false,
} as SpeechSynthesisVoice;

const setOnline = (onLine: boolean) =>
  jest.spyOn(globalThis.navigator, 'onLine', 'get').mockReturnValue(onLine);

beforeEach(() => {
  jest.useFakeTimers();
  spoken = [];
  voices = [david];
  synth = {
    getVoices: () => voices,
    speak: (u: FakeUtterance) => spoken.push(u),
    cancel: jest.fn(() => {
      const u = spoken[spoken.length - 1];
      u?.onerror?.({ error: 'interrupted' });
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  Object.assign(globalThis, {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: FakeUtterance,
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('speakReferenceText', () => {
  it('reports noVoice when no voice speaks the language', async () => {
    const speaking = speakReferenceText(arabic, text);
    await jest.advanceTimersByTimeAsync(VOICES_WAIT_MS);
    await expect(speaking.done).resolves.toBe('noVoice');
    expect(spoken).toHaveLength(0);
  });

  it('reports noVoice when the device has no speech at all', async () => {
    Object.assign(globalThis, { speechSynthesis: undefined });
    await expect(speakReferenceText(bsb, text).done).resolves.toBe('noVoice');
  });

  it('reports noVoiceOffline when offline and only network voices speak it', async () => {
    voices = [google];
    setOnline(false);
    const speaking = speakReferenceText(bsb, text);
    await settle();
    await expect(speaking.done).resolves.toBe('noVoiceOffline');
    expect(spoken).toHaveLength(0);
  });

  it('speaks with a network voice when online and it is the only one', async () => {
    voices = [google];
    setOnline(true);
    speakReferenceText(bsb, 'Short.');
    await settle();
    expect(spoken[0].voice).toBe(google);
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

  it("speaks with the team's ranked voice when the device has it", async () => {
    const zira = { ...david, name: 'Zira', voiceURI: 'Zira', default: false };
    voices = [david, zira];
    speakReferenceText(bsb, 'Short.', undefined, {
      en: [
        { name: 'Mark', voiceURI: 'Mark', lang: 'en-US', localService: true },
        { name: 'Zira', voiceURI: 'Zira', lang: 'en-US', localService: true },
      ],
    });
    await settle();
    expect(spoken[0].voice).toBe(zira);
  });

  it('speaks English when Windows lists Microsoft voices before their languages', async () => {
    const blankDavid = {
      ...david,
      name: 'Microsoft David',
      voiceURI: 'Microsoft David',
      lang: '',
    };
    const blankFrench = {
      ...david,
      name: 'Microsoft Caroline',
      voiceURI: 'Microsoft Caroline',
      lang: '',
      default: false,
    };
    voices = [blankDavid, blankFrench];
    const changed = changedVoices();

    const speaking = speakReferenceText(bsb, 'In the beginning.');
    changed();
    voices = [
      { ...blankDavid, lang: 'en-US' },
      { ...blankFrench, lang: 'fr-CA' },
    ];
    changed();
    await settle();
    expect(spoken[0]?.voice?.lang).toBe('en-US');
    expect(spoken[0]?.voice?.name).toBe('Microsoft David');
    spoken[0].onend?.();
    await expect(speaking.done).resolves.toBe('ended');
  });

  it('waits to speak English while David is still untagged', async () => {
    const blankDavid = {
      ...david,
      name: 'Microsoft David',
      voiceURI: 'Microsoft David',
      lang: '',
    };
    const caroline = {
      ...david,
      name: 'Microsoft Caroline',
      voiceURI: 'Microsoft Caroline',
      lang: 'fr-CA',
      default: false,
    };
    voices = [blankDavid, caroline];
    const changed = changedVoices();

    const speaking = speakReferenceText(bsb, 'In the beginning.');
    await settle();
    changed();
    await settle();
    expect(spoken).toHaveLength(0);

    voices = [{ ...blankDavid, lang: 'en-US' }, caroline];
    changed();
    await jest.advanceTimersByTimeAsync(VOICES_QUIET_MS - 1);
    expect(spoken).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(spoken[0]?.voice?.name).toBe('Microsoft David');
    expect(spoken[0]?.voice?.lang).toBe('en-US');
    spoken[0].onend?.();
    await expect(speaking.done).resolves.toBe('ended');
  });

  it('waits to speak English when French is listed before David', async () => {
    const caroline = {
      ...david,
      name: 'Microsoft Caroline',
      voiceURI: 'Microsoft Caroline',
      lang: 'fr-CA',
      default: false,
    };
    const microsoftDavid = {
      ...david,
      name: 'Microsoft David',
      voiceURI: 'Microsoft David',
      lang: 'en-US',
    };
    voices = [caroline];
    const changed = changedVoices();

    const speaking = speakReferenceText(bsb, 'In the beginning.');
    await settle();
    expect(spoken).toHaveLength(0);

    voices = [caroline, microsoftDavid];
    changed();
    await settle();
    expect(spoken[0]?.voice?.name).toBe('Microsoft David');
    expect(spoken[0]?.voice?.lang).toBe('en-US');
    spoken[0].onend?.();
    await expect(speaking.done).resolves.toBe('ended');
  });

  it('speaks a later passage without waiting for the voice list again', async () => {
    speakReferenceText(bsb, 'One.');
    await Promise.resolve();
    expect(spoken).toHaveLength(0);
    await settle();
    expect(spoken.map((u) => u.text)).toEqual(['One.']);

    speakReferenceText(bsb, 'Two.');
    await Promise.resolve();
    expect(spoken.map((u) => u.text)).toEqual(['One.', 'Two.']);
  });
});

describe('speakText', () => {
  it('speaks with the chosen voice and stops a passage already speaking', async () => {
    const passage = speakReferenceText(bsb, text);
    await settle();
    const sample = speakText({
      text: 'Sample.',
      lang: 'en-US',
      chooseVoice: () => david,
    });
    await expect(passage.done).resolves.toBe('stopped');
    await settle();
    const last = spoken[spoken.length - 1];
    expect(last.text).toBe('Sample.');
    last.onend?.();
    await expect(sample.done).resolves.toBe('ended');
  });
});
