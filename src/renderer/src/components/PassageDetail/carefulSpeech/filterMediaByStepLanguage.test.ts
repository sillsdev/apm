import { MediaFileD } from '../../../model';
import {
  filterMediaByStepLanguage,
  mediaMatchesStepLanguage,
} from './matchesGuidedOutputRow';

function makeMedia(
  id: string,
  languagebcp47?: string
): MediaFileD {
  return {
    id,
    type: 'mediafile',
    attributes: {
      ...(languagebcp47 != null ? { languagebcp47 } : {}),
    },
  } as MediaFileD;
}

describe('filterMediaByStepLanguage', () => {
  const en = makeMedia('en', 'English|en');
  const ar = makeMedia('ar', 'Arabic|ar');
  const fr = makeMedia('fr', 'French|fr');
  const legacy = makeMedia('legacy');

  it('returns all media when language filter is inactive', () => {
    const all = [en, ar, fr];
    expect(filterMediaByStepLanguage(all)).toEqual(all);
    expect(filterMediaByStepLanguage(all, 'und')).toEqual(all);
    expect(filterMediaByStepLanguage(all, '')).toEqual(all);
  });

  it('keeps only media matching the step LWC (TT-7557)', () => {
    expect(filterMediaByStepLanguage([en, ar, fr], 'ar').map((m) => m.id)).toEqual([
      'ar',
    ]);
    expect(filterMediaByStepLanguage([en, ar, fr], 'en').map((m) => m.id)).toEqual([
      'en',
    ]);
  });

  it('excludes legacy untagged media when a language is active', () => {
    expect(
      filterMediaByStepLanguage([ar, legacy], 'ar').map((m) => m.id)
    ).toEqual(['ar']);
  });

  it('mediaMatchesStepLanguage matches Name|bcp47 and bare bcp47', () => {
    expect(mediaMatchesStepLanguage(en, 'en')).toBe(true);
    expect(mediaMatchesStepLanguage(makeMedia('bare', 'ar'), 'ar')).toBe(true);
    expect(mediaMatchesStepLanguage(ar, 'en')).toBe(false);
  });
});
