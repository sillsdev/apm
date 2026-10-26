import { ArtifactTypeSlug } from './artifactTypeSlug';
import {
  isSpellCheckOnByDefault,
  hasSpellCheckerDictionary,
  isStepSpellCheckOn,
} from './stepSpellCheck';

describe('hasSpellCheckerDictionary', () => {
  test('matches exact and primary subtags', () => {
    const avail = ['en-US', 'fr'];
    expect(hasSpellCheckerDictionary('en-US', avail)).toBe(true);
    expect(hasSpellCheckerDictionary('en', avail)).toBe(true);
    expect(hasSpellCheckerDictionary('fr-CA', avail)).toBe(true);
    expect(hasSpellCheckerDictionary('de', avail)).toBe(false);
  });

  test('returns false for und or empty list', () => {
    expect(hasSpellCheckerDictionary('en', [])).toBe(false);
    expect(hasSpellCheckerDictionary('und', ['en'])).toBe(false);
  });
});

describe('isStepSpellCheckOn', () => {
  const avail = ['en-US', 'es'];

  test('uses explicit step setting', () => {
    expect(
      isStepSpellCheckOn(
        { spellCheck: false },
        ArtifactTypeSlug.PhraseBackTranslation,
        'en',
        avail
      )
    ).toBe(false);
    expect(
      isStepSpellCheckOn(
        { spellCheck: true },
        ArtifactTypeSlug.Vernacular,
        'en',
        avail
      )
    ).toBe(true);
  });

  test('defaults vernacular and careful speech to false', () => {
    expect(
      isStepSpellCheckOn({}, ArtifactTypeSlug.Vernacular, 'en', avail)
    ).toBe(false);
    expect(
      isStepSpellCheckOn({}, ArtifactTypeSlug.CarefulSpeech, 'en', avail)
    ).toBe(false);
  });

  test('defaults back translation to true when dictionary exists', () => {
    expect(
      isStepSpellCheckOn(
        {},
        ArtifactTypeSlug.PhraseBackTranslation,
        'en',
        avail
      )
    ).toBe(true);
    expect(
      isStepSpellCheckOn({}, ArtifactTypeSlug.WholeBackTranslation, 'es', avail)
    ).toBe(true);
  });

  test('defaults back translation to true even without dictionary (Desktop)', () => {
    expect(
      isStepSpellCheckOn(
        {},
        ArtifactTypeSlug.PhraseBackTranslation,
        'de',
        avail
      )
    ).toBe(true);
    expect(
      isStepSpellCheckOn(
        {},
        ArtifactTypeSlug.PhraseBackTranslation,
        'und',
        avail
      )
    ).toBe(true);
  });

  test('defaults back translation to true when checker languages are unavailable', () => {
    expect(
      isStepSpellCheckOn({}, ArtifactTypeSlug.PhraseBackTranslation, 'de')
    ).toBe(true);
    expect(
      isStepSpellCheckOn({}, ArtifactTypeSlug.WholeBackTranslation, 'de', [])
    ).toBe(true);
  });
});

describe('isSpellCheckOnByDefault', () => {
  test('matches resolve defaults', () => {
    expect(
      isSpellCheckOnByDefault(ArtifactTypeSlug.Vernacular, 'en', ['en'])
    ).toBe(false);
    expect(
      isSpellCheckOnByDefault(ArtifactTypeSlug.PhraseBackTranslation, 'de', [
        'en-US',
      ])
    ).toBe(true);
  });
});
