import { ArtifactTypeSlug } from './artifactTypeSlug';
import {
  bcp47FromStepLanguage,
  defaultSpellCheckForArtifact,
  hasSpellCheckerDictionary,
  resolveStepSpellCheck,
} from './stepSpellCheck';

describe('bcp47FromStepLanguage', () => {
  test('parses BCP47 from step language field', () => {
    expect(bcp47FromStepLanguage('English|en')).toBe('en');
    expect(bcp47FromStepLanguage('Unknown|und')).toBeUndefined();
    expect(bcp47FromStepLanguage(undefined)).toBeUndefined();
  });
});

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

describe('resolveStepSpellCheck', () => {
  const avail = ['en-US', 'es'];

  test('uses explicit step setting', () => {
    expect(
      resolveStepSpellCheck(
        { spellCheck: false },
        ArtifactTypeSlug.PhraseBackTranslation,
        'en',
        avail
      )
    ).toBe(false);
    expect(
      resolveStepSpellCheck(
        { spellCheck: true },
        ArtifactTypeSlug.Vernacular,
        'en',
        avail
      )
    ).toBe(true);
  });

  test('defaults vernacular and careful speech to false', () => {
    expect(
      resolveStepSpellCheck({}, ArtifactTypeSlug.Vernacular, 'en', avail)
    ).toBe(false);
    expect(
      resolveStepSpellCheck({}, ArtifactTypeSlug.CarefulSpeech, 'en', avail)
    ).toBe(false);
  });

  test('defaults back translation to true when dictionary exists', () => {
    expect(
      resolveStepSpellCheck(
        {},
        ArtifactTypeSlug.PhraseBackTranslation,
        'en',
        avail
      )
    ).toBe(true);
    expect(
      resolveStepSpellCheck(
        {},
        ArtifactTypeSlug.WholeBackTranslation,
        'es',
        avail
      )
    ).toBe(true);
  });

  test('defaults back translation to false without dictionary', () => {
    expect(
      resolveStepSpellCheck(
        {},
        ArtifactTypeSlug.PhraseBackTranslation,
        'de',
        avail
      )
    ).toBe(false);
  });

  test('defaults back translation to true when checker languages are unavailable', () => {
    expect(
      resolveStepSpellCheck(
        {},
        ArtifactTypeSlug.PhraseBackTranslation,
        'de'
      )
    ).toBe(true);
    expect(
      resolveStepSpellCheck({}, ArtifactTypeSlug.WholeBackTranslation, 'de', [])
    ).toBe(true);
  });
});

describe('defaultSpellCheckForArtifact', () => {
  test('matches resolve defaults', () => {
    expect(
      defaultSpellCheckForArtifact(ArtifactTypeSlug.Vernacular, 'en', ['en'])
    ).toBe(false);
    expect(
      defaultSpellCheckForArtifact(
        ArtifactTypeSlug.PhraseBackTranslation,
        'en',
        ['en-US']
      )
    ).toBe(true);
  });
});
