import { ArtifactTypeSlug } from '../crud';

export const integrationSlug = (
  exportType: string | undefined,
  offline: boolean
): string => {
  const type =
    exportType === ArtifactTypeSlug.PhraseBackTranslation
      ? ArtifactTypeSlug.PhraseBackTranslation
      : exportType === ArtifactTypeSlug.WholeBackTranslation
        ? ArtifactTypeSlug.WholeBackTranslation
        : '';
  return 'paratext' + (offline ? 'Local' : '') + type;
};
