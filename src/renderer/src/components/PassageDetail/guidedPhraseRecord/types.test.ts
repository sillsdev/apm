import { NamedRegions } from '../../../utils/namedSegments';
import { LocalKey } from '../../../utils/localUserKey';
import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';
import { CAREFUL_SPEECH_CONFIG, phraseBackTranslateConfig } from './types';

describe('guidedPhraseRecord config', () => {
  it('Careful Speech uses clause regions and boundary tools', () => {
    expect(CAREFUL_SPEECH_CONFIG.namedRegion).toBe(NamedRegions.Clause);
    expect(CAREFUL_SPEECH_CONFIG.showBoundaryTools).toBe(true);
    expect(CAREFUL_SPEECH_CONFIG.requireBoldWorkflow).toBe(true);
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
  });

  it('Retell BT is single-segment without boundary tools', () => {
    const config = phraseBackTranslateConfig(
      ArtifactTypeSlug.Retell,
      NamedRegions.BackTranslation
    );
    expect(config.singleSegmentMode).toBe(true);
    expect(config.showBoundaryTools).toBe(false);
  });

  it('buildFilenamePostfix adds segment suffix after the first unit', () => {
    const config = phraseBackTranslateConfig(
      ArtifactTypeSlug.PhraseBackTranslation,
      NamedRegions.BackTranslation
    );
    expect(config.buildFilenamePostfix(0, 2)).toBe('backtranslation1_v2');
    expect(config.buildFilenamePostfix(1, 2)).toBe('backtranslation2_v2s1');
  });
});
