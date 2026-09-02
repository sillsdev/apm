import { describe, expect, it } from '@jest/globals';
import { NamedRegions } from '../../../utils/namedSegments';
import { LocalKey } from '../../../utils/localUserKey';
import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';
import {
  CAREFUL_SPEECH_CONFIG,
  newTakeToken,
  phraseBackTranslateConfig,
} from './types';

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
    expect(config.buildFilenamePostfix(0, 2)).toBe('backtranslation1_v2');
    expect(config.buildFilenamePostfix(1, 2)).toBe('backtranslation2_v2s1');
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
    expect(config.buildFilenamePostfix(0, 1, 'seh')).toBe(
      'backtranslation1_v1_seh'
    );
    expect(config.buildFilenamePostfix(0, 1, 'he')).toBe(
      'backtranslation1_v1_he'
    );
    expect(config.buildFilenamePostfix(1, 1, 'he')).toBe(
      'backtranslation2_v1s1_he'
    );
    // Steps with no configured language keep the names they always had.
    expect(config.buildFilenamePostfix(0, 1)).toBe('backtranslation1_v1');
  });

  it('buildFilenamePostfix separates the takes of one segment (TT-7432)', () => {
    // Segment index, source version and step language are all the same for two
    // takes of the same segment in the same step, so deleting a recording and
    // recording it again uploaded the replacement under the name the deleted
    // take is cached on, and the deleted audio is what played back. Each take
    // has to bring its own token.
    const config = phraseBackTranslateConfig(
      ArtifactTypeSlug.PhraseBackTranslation,
      NamedRegions.BackTranslation
    );
    expect(
      CAREFUL_SPEECH_CONFIG.buildFilenamePostfix(0, 1, undefined, 't1')
    ).toBe('carefulspeech1_v1_t1');
    expect(
      CAREFUL_SPEECH_CONFIG.buildFilenamePostfix(0, 1, undefined, 't2')
    ).not.toBe(
      CAREFUL_SPEECH_CONFIG.buildFilenamePostfix(0, 1, undefined, 't1')
    );
    expect(config.buildFilenamePostfix(1, 1, 'he', 't1')).toBe(
      'backtranslation2_v1s1_he_t1'
    );
    // Takes made before this stay on the names they were uploaded under.
    expect(CAREFUL_SPEECH_CONFIG.buildFilenamePostfix(0, 1)).toBe(
      'carefulspeech1_v1'
    );
  });
});

describe('newTakeToken', () => {
  it('never repeats a token, even inside one millisecond', () => {
    const now = 1767225600000;
    expect(newTakeToken(now)).not.toEqual(newTakeToken(now));
  });

  it('grows with the clock so a later take sorts after an earlier one', () => {
    expect(newTakeToken(1767225600000) < newTakeToken(1767225700000)).toBe(
      true
    );
  });
});
