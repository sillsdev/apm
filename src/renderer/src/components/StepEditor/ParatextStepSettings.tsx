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
      // Tolerates settings that still hold an id from before the slug switch.
      setInitialValue(slugFromId(json.artifactTypeId ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSettings]);
  const handleSelect = (slug: ArtifactTypeSlug | null) => {
    onChange(JSON.stringify({ artifactTypeId: slug }));
  };

  return (
    <SelectArtifactType
      onTypeChange={handleSelect}
      limit={artifacts}
      initialValue={initialValue}
    />
  );
};
