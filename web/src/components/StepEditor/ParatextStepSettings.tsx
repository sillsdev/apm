import { useEffect, useState } from 'react';
import { ArtifactTypeSlug, useArtifactType } from '../../crud';
import SelectArtifactType from '../Sheet/SelectArtifactType';

interface IProps {
  toolSettings: string;
  onChange: (toolSettings: string) => void;
}

export const ParatextStepSettings = ({ toolSettings, onChange }: IProps) => {
  // const classes = useStyles();
  const { slugFromId } = useArtifactType();
  const artifacts = [
    ArtifactTypeSlug.Vernacular,
    ArtifactTypeSlug.WholeBackTranslation,
    ArtifactTypeSlug.PhraseBackTranslation,
  ];
  const [initialValue, setInitialValue] = useState<ArtifactTypeSlug | null>(
    null
  );
  useEffect(() => {
    if (toolSettings) {
      const json = JSON.parse(toolSettings);
      // Normalizes settings that still hold an id from before the slug switch.
      setInitialValue(slugFromId(json.artifactTypeId ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSettings]);
  // Step settings store the slug; readers convert it to an id at the DB boundary.
  const handleSelect = (artifactTypeSlug: ArtifactTypeSlug | null) => {
    onChange(JSON.stringify({ artifactTypeId: artifactTypeSlug }));
  };

  return (
    <SelectArtifactType
      onTypeChange={handleSelect}
      limit={artifacts}
      initialValue={initialValue}
    />
  );
};
