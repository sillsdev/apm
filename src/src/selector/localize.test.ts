import { shallowEqual } from 'react-redux';
import localStrings from './localize';
import { IState } from '../model';

/** Minimal LocalizedStrings-like source (avoid importing ESM react-localization in Jest). */
function makeSource() {
  let lang = 'en';
  const data: Record<string, Record<string, string>> = {
    en: { open: 'Show Discussion pane', close: 'Hide Discussion pane' },
    'zh-Hans': { open: '显示“讨论”窗格', close: '隐藏“讨论”窗格' },
  };
  const source: Record<string, unknown> = {
    setLanguage: (next: string) => {
      lang = next;
    },
    getLanguage: () => lang,
  };
  for (const key of Object.keys(data.en)) {
    Object.defineProperty(source, key, {
      enumerable: true,
      configurable: true,
      get() {
        return data[lang]?.[key] ?? data.en[key];
      },
    });
  }
  return source;
}

describe('localStrings', () => {
  const source = makeSource();

  const makeState = (lang: string): IState =>
    ({
      strings: {
        lang,
        discussionList: source,
      },
    }) as unknown as IState;

  it('exposes enumerable lang so shallowEqual detects language changes', () => {
    const en = localStrings(makeState('en'), { layout: 'discussionList' });
    const zh = localStrings(makeState('zh-Hans'), {
      layout: 'discussionList',
    });

    expect(en.lang).toBe('en');
    expect(zh.lang).toBe('zh-Hans');
    expect(shallowEqual(en, zh)).toBe(false);
    expect(zh.open).toBe('显示“讨论”窗格');
  });

  it('returns a stable reference for the same language', () => {
    const state = makeState('en');
    const first = localStrings(state, { layout: 'discussionList' });
    const second = localStrings(state, { layout: 'discussionList' });
    expect(first).toBe(second);
  });
});
