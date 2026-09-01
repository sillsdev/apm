import { describe, expect, it } from '@jest/globals';
import { NamedRegions } from '../../../utils/namedSegments';
import { LocalKey } from '../../../utils/localUserKey';
import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';
import { CAREFUL_SPEECH_CONFIG, phraseBackTranslateConfig } from './types';

describe('guidedPhraseRecord config', () => {
  it('Careful Speech uses clause regions and boundary tools', () => {
    expect(CAREFUL_SPEECH_CONFIG.namedRegion).toBe(NamedRegions.Clause);
    expect(CAREFUL_SPEECH_CONFIG.showBoundaryTools).toBe(true);
    expect(CAREFUL_SPEECH_CONFIG.requireBoldWorkflow).toBe(true);
    expect(CAREFUL_SPEECH_CONFIG.constrainAutoSegmentWithVerses).toBe(false);
    expect(CAREFUL_SPEECH_CONFIG.showPlayerSegmentControls).toBe(false);
    expect(CAREFUL_SPEECH_CONFIG.multiLevelSegmentUndo).toBe(false);
    expect(CAREFUL_SPEECH_CONFIG.sequentialUnitNavAroundRecord).toBe(false);
  });

  it('PBT uses BT regions with boundary tools', () => {
    const config = phraseBackTranslateConfig(
      ArtifactTypeSlug.PhraseBackTranslation,
      NamedRegions.BackTranslation
    );
    expect(config.namedRegion).toBe(NamedRegions.BackTranslation);
    expect(config.singleSegmentMode).toBe(false);
    expect(config.showBoundaryTools).toBe(true);
    expect(config.speakerLocalKey).toBe(LocalKey.phraseBackSpeaker);
    expect(config.constrainAutoSegmentWithVerses).toBe(true);
    expect(config.showPlayerSegmentControls).toBe(true);
    expect(config.showSegmentResetInRecordingPass).toBe(true);
    expect(config.multiLevelSegmentUndo).toBe(true);
    expect(config.sequentialUnitNavAroundRecord).toBe(true);
    expect(config.persistSegments).toBe(true);
  });

  it('Retell BT is single-segment without boundary tools', () => {
    const config = phraseBackTranslateConfig(
      ArtifactTypeSlug.Retell,
      NamedRegions.BackTranslation
    );
    expect(config.singleSegmentMode).toBe(true);
    expect(config.showBoundaryTools).toBe(false);
    expect(config.constrainAutoSegmentWithVerses).toBe(false);
    expect(config.showPlayerSegmentControls).toBe(false);
    expect(config.multiLevelSegmentUndo).toBe(false);
    expect(config.sequentialUnitNavAroundRecord).toBe(false);
    expect(config.persistSegments).toBe(false);
  });

  it('buildFilenamePostfix adds segment suffix after the first unit', () => {
    const config = phraseBackTranslateConfig(
      ArtifactTypeSlug.PhraseBackTranslation,
      NamedRegions.BackTranslation
    );
    expect(
      config.buildFilenamePostfix({ unitIndex: 0, sourceVersion: 2 })
    ).toBe('backtranslation1_v2');
    expect(
      config.buildFilenamePostfix({ unitIndex: 1, sourceVersion: 2 })
    ).toBe('backtranslation2_v2s1');
  });

  it('buildFilenamePostfix separates the languages of the same segment', () => {
    // Media is cached on disk under the uploaded file's name (dataPath maps a
    // mediafile's audioUrl to `<offlineData>/media/<basename>`), so a name
    // shared by two takes means one cached file for both, and the first one
    // cached is what plays. A Phrase BT step per language records the same
    // segment of the same vernacular, so the language has to be in the name
    // (TT-7643).
    const config = phraseBackTranslateConfig(
      ArtifactTypeSlug.PhraseBackTranslation,
      NamedRegions.BackTranslation
    );
    const parts = { unitIndex: 0, sourceVersion: 1 };
    expect(
      config.buildFilenamePostfix({ ...parts, languageBcp47: 'seh' })
    ).toBe('backtranslation1_v1_seh');
    expect(config.buildFilenamePostfix({ ...parts, languageBcp47: 'he' })).toBe(
      'backtranslation1_v1_he'
    );
    expect(
      config.buildFilenamePostfix({
        unitIndex: 1,
        sourceVersion: 1,
        languageBcp47: 'he',
      })
    ).toBe('backtranslation2_v1s1_he');
    // Steps with no configured language keep the names they always had.
    expect(config.buildFilenamePostfix(parts)).toBe('backtranslation1_v1');
  });

  it('buildFilenamePostfix separates one attempt at a segment from the next', () => {
    // Clearing a take deletes its mediafile but not the audio cached under
    // its name, so a re-record that reused the name played the discarded take
    // back (TT-7432).
    const config = phraseBackTranslateConfig(
      ArtifactTypeSlug.PhraseBackTranslation,
      NamedRegions.BackTranslation
    );
    const parts = { unitIndex: 0, sourceVersion: 1, languageBcp47: 'seh' };
    expect(config.buildFilenamePostfix({ ...parts, takeToken: 'aaa' })).toBe(
      'backtranslation1_v1_seh_taaa'
    );
    expect(
      config.buildFilenamePostfix({ ...parts, takeToken: 'aaa' })
    ).not.toEqual(config.buildFilenamePostfix({ ...parts, takeToken: 'bbb' }));
    // Careful Speech records per clause and needs the same separation.
    expect(
      CAREFUL_SPEECH_CONFIG.buildFilenamePostfix({
        unitIndex: 1,
        sourceVersion: 3,
        takeToken: 'zzz',
      })
    ).toBe('carefulspeech2_v3_tzzz');
  });
});
