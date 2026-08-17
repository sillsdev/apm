import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState, type RefObject } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { ArtifactCategoryType, useOrganizedBy } from '../../../crud';
import {
  IPassageDetailArtifactsStrings,
  ISharedStrings,
  MediaFileD,
} from '../../../model';
import {
  passageDetailArtifactsSelector,
  sharedSelector,
} from '../../../selector';
import SelectArtifactCategory from '../../Sheet/SelectArtifactCategory';
import { ResourceTypeEnum } from './ResourceTypeEnum';
import { MarkDownType, UriLinkType } from '../../MediaUpload';
import { UploadType } from '../../UploadType';
import { LinkEdit } from '../../../control/LinkEdit';
import { MarkDownEdit } from '../../../control/MarkDownEdit';
import { mediaContentType } from '../../../utils/contentType';
import { MarkDownView } from '../../../control/MarkDownView';
import { ArtCatScr } from '../../../components/Sheet/ArtCatScr';
import { descriptionRequiredForResource } from './resourceArtifactName';

interface IProps {
  media?: MediaFileD | undefined;
  uploadType?: UploadType | undefined;
  initCategory: string;
  initDescription: string;
  initPassRes: boolean;
  onCategoryChange: (artifactCategoryId: string) => void;
  onDescriptionChange: (desc: string) => void;
  onPassResChange?: ((value: ResourceTypeEnum) => void) | undefined;
  onTextChange?: ((text: string) => void) | undefined;
  allowProject: boolean;
  catRequired: boolean;
  catAllowNew?: boolean | undefined;
  // Forwarded to SelectArtifactCategory so the parent form can create a new
  // category at submission (rather than on blur).
  catCommitRef?: RefObject<(() => Promise<string>) | null> | undefined;
  sectDesc?: string | undefined;
  passDesc?: string | undefined;
  wrapPreviewOverflow?: boolean;
}
export function ResourceData(props: IProps) {
  const {
    initCategory,
    initDescription,
    initPassRes,
    onCategoryChange,
    onDescriptionChange,
    onPassResChange,
    catRequired,
    catAllowNew,
    allowProject,
    sectDesc,
    passDesc,
    media,
    uploadType,
    onTextChange,
    wrapPreviewOverflow,
    catCommitRef,
  } = props;
  const [description, setDescription] = useState(initDescription);
  const { getOrganizedBy } = useOrganizedBy();
  const resourceKindFromProps = () =>
    uploadType === UploadType.ProjectResource
      ? 'general'
      : initPassRes
        ? 'passage'
        : 'section';
  const [value, setValue] = useState(resourceKindFromProps);
  const [text, setText] = useState(media?.attributes?.originalFile ?? '');
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const descriptionRequired = descriptionRequiredForResource(
    mediaContentType(media),
    uploadType
  );

  useEffect(() => setDescription(initDescription), [initDescription]);

  useEffect(() => {
    setValue(resourceKindFromProps());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadType, initPassRes]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = (event.target as HTMLInputElement).value;
    setValue(newValue);
    onPassResChange &&
      onPassResChange(
        newValue === 'section'
          ? ResourceTypeEnum.sectionResource
          : newValue === 'passage'
            ? ResourceTypeEnum.passageResource
            : ResourceTypeEnum.projectResource
      );
  };
  const handleChangeDescription = (e: any) => {
    e.persist();
    setDescription(e.target.value);
    onDescriptionChange(e.target.value);
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    onTextChange && onTextChange(newText);
  };

  return (
    <Stack spacing={2}>
      {mediaContentType(media) === UriLinkType && (
        <LinkEdit inValue={text} onValue={handleTextChange} />
      )}
      {mediaContentType(media) === MarkDownType && (
        <MarkDownEdit
          inValue={text}
          onValue={handleTextChange}
          wrapPreviewOverflow={wrapPreviewOverflow}
        />
      )}
      <Grid container spacing={2} sx={{ pt: 1 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            id="description"
            label={ts.description}
            value={description || ''}
            onChange={handleChangeDescription}
            required={descriptionRequired}
            error={descriptionRequired && !(description || '').trim()}
            fullWidth={true}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectArtifactCategory
            allowNew={catAllowNew}
            initCategory={initCategory || ''}
            onCategoryChange={onCategoryChange}
            required={catRequired}
            scripture={ArtCatScr.highlight}
            type={ArtifactCategoryType.Resource}
            commitRef={catCommitRef}
          />
        </Grid>
      </Grid>
      {onPassResChange && (
        <FormControl>
          <FormLabel id="resourcekind">{t.tip1a}</FormLabel>
          <RadioGroup
            aria-labelledby="resourcekind"
            value={value}
            onChange={handleChange}
            name="radio-buttons-group"
          >
            <FormControlLabel
              value={'section'}
              control={<Radio />}
              label={t.currentResource.replace(
                '{0}',
                sectDesc ?? getOrganizedBy(true)
              )}
            />
            <FormControlLabel
              value={'passage'}
              control={<Radio />}
              label={t.currentResource.replace(
                '{0}',
                passDesc ?? t.passageResource
              )}
            />
            {allowProject &&
              ![
                UploadType.Link,
                UploadType.MarkDown,
                UploadType.FaithbridgeLink,
              ].includes(uploadType ?? UploadType.Resource) && (
                <FormControlLabel
                  value={'general'}
                  control={<Radio />}
                  label={t.uploadProject.replace(
                    '{0}',
                    getOrganizedBy(false)
                  )}
                />
              )}
          </RadioGroup>
        </FormControl>
      )}
      {media &&
        mediaContentType(media).startsWith('audio') &&
        Boolean(media?.attributes.transcription) && (
          <Stack spacing={1}>
            <Typography variant="h6" sx={{ pt: 1 }}>
              {t.transcription}
            </Typography>
            <MarkDownView value={media?.attributes.transcription || ''} />
          </Stack>
        )}
    </Stack>
  );
}
export default ResourceData;
