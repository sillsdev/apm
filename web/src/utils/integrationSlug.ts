import { ArtifactTypeSlug } from '../crud';

export const integrationSlug = (
  exportType: string | undefined,
  offline: boolean
): string => {
  const type =
    exportType === ArtifactTypeSlug.PhraseBackTranslation
      ? 'backtranslation'
      : exportType === ArtifactTypeSlug.WholeBackTranslation
        ? 'wholebacktranslation'
        : '';
  return 'paratext' + (offline ? 'Local' : '') + type;
};
