import { MediaFileD } from '../../../model';
import { mediaMatchesStepLanguage } from './matchesGuidedOutputRow';

/** Mediafile carrying only a `Name|bcp47` language tag (or none). */
const mediaWithLanguage = (languagebcp47?: string) =>
  ({
    type: 'mediafile',
    id: 'm1',
    attributes: {
      ...(languagebcp47 != null ? { languagebcp47 } : {}),
    },
  }) as unknown as MediaFileD;

describe('mediaMatchesStepLanguage', () => {
  it('keeps everything when the step has no language', () => {
    expect(
      mediaMatchesStepLanguage(mediaWithLanguage('French|fr'), undefined)
    ).toBe(true);
    expect(mediaMatchesStepLanguage(mediaWithLanguage('French|fr'), '')).toBe(
      true
    );
    expect(
      mediaMatchesStepLanguage(mediaWithLanguage('French|fr'), 'und')
    ).toBe(true);
  });

  it('keeps media tagged with the step language', () => {
    expect(mediaMatchesStepLanguage(mediaWithLanguage('French|fr'), 'fr')).toBe(
      true
    );
    expect(mediaMatchesStepLanguage(mediaWithLanguage('fr'), 'fr')).toBe(true);
  });

  it('drops media tagged with another language', () => {
    expect(
      mediaMatchesStepLanguage(mediaWithLanguage('English|en'), 'fr')
    ).toBe(false);
  });

  it('drops untagged media when the step has a language', () => {
    expect(mediaMatchesStepLanguage(mediaWithLanguage(), 'fr')).toBe(false);
    expect(mediaMatchesStepLanguage(mediaWithLanguage(''), 'fr')).toBe(false);
    expect(mediaMatchesStepLanguage(undefined, 'fr')).toBe(false);
  });
});
