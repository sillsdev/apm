import { useEffect, useState } from 'react';
import { Box, MenuItem, SxProps, TextField } from '@mui/material';
import { ArtifactTypeSlug, IArtifactType, useArtifactType } from '../../crud';
import { ISelectArtifactTypeStrings } from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { artifactTypeSelector } from '../../selector';

const smallProps = { fontSize: 'small' } as SxProps;

interface IProps {
  /** Receives the chosen artifact-type slug, or null for Vernacular. */
  onTypeChange: (slug: ArtifactTypeSlug | null) => void; // TODO rename "slug" to "artifactTypeSlug" for clarity
  /** The currently selected slug (null/Vernacular when unset). */
  initialValue?: ArtifactTypeSlug | null;
  limit?: ArtifactTypeSlug[];
}

export const SelectArtifactType = (props: IProps) => {
  const { onTypeChange, initialValue, limit } = props;
  const [artifactType, setArtifactType] = useState<ArtifactTypeSlug>(
    ArtifactTypeSlug.Vernacular
  );
  const { getArtifactTypes } = useArtifactType();
  const [artifactTypes, setArtifactTypes] = useState<IArtifactType[]>([]);
  const t: ISelectArtifactTypeStrings = useSelector(
    artifactTypeSelector,
    shallowEqual
  );

  const handleArtifactTypeChange = (e: any) => {
    const slug = e.target.value as ArtifactTypeSlug; // TODO rename "slug" to "artifactTypeSlug" for clarity
    setArtifactType(slug);
    onTypeChange(slug === ArtifactTypeSlug.Vernacular ? null : slug);
  };

  useEffect(() => {
    setArtifactTypes(getArtifactTypes(limit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  useEffect(() => {
    const curType = initialValue ?? ArtifactTypeSlug.Vernacular;
    if (curType !== artifactType) setArtifactType(curType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <TextField
        id="artifact-type"
        select
        label={t.artifactType}
        sx={{ mx: 1, width: '400px' }}
        value={
          artifactTypes.map((t) => t.slug).includes(artifactType)
            ? artifactType
            : ''
        }
        onChange={handleArtifactTypeChange}
        SelectProps={{
          MenuProps: {
            sx: { width: '300px' },
          },
        }}
        InputProps={{
          sx: smallProps,
        }}
        InputLabelProps={{
          sx: smallProps,
        }}
        margin="normal"
        variant="filled"
        required={true}
      >
        {artifactTypes.map((option: IArtifactType) => (
          <MenuItem key={option.slug} value={option.slug}>
            {option?.type}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

export default SelectArtifactType;
