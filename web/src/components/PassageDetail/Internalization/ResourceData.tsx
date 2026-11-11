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
import React, { useState, type RefObject } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { ArtifactCategoryType, useOrganizedBy } from '../../../crud';
import {
  IPassageDetailArtifactsStrings,
  MediaFileD,
  SheetLevel,
} from '../../../model';
import { PassageTypeEnum } from '../../../model/passageTypeEnum';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { passageDetailArtifactsSelector } from '../../../selector';
import SelectArtifactCategory from '../../Sheet/SelectArtifactCategory';
import { ResourceTypeEnum } from './ResourceTypeEnum';
import { MarkDownType, UriLinkType } from '../../../utils/contentType';
import { NON_FILE_UPLOAD_TYPES, UploadType } from '../../UploadType';
import { LinkEdit } from '../../../control/LinkEdit';
import { MarkDownEdit } from '../../../control/MarkDownEdit';
import { mediaContentType } from '../../../utils/contentType';
import { MarkDownView } from '../../../control/MarkDownView';
import { ArtCatScr } from '../../../components/Sheet/ArtCatScr';
import { descriptionRequiredForResource } from './resourceArtifactName';
import usePassageDetailContext from '../../../context/usePassageDetailContext';

type ResourceKindRadio = 'section' | 'passage' | 'general';

const resourceKindToRadio = (kind: ResourceTypeEnum): ResourceKindRadio =>
  kind === ResourceTypeEnum.projectResource
    ? 'general'
    : kind === ResourceTypeEnum.passageResource
      ? 'passage'
      : 'section';

const radioToResourceKind = (value: string): ResourceTypeEnum =>
  value === 'section'
    ? ResourceTypeEnum.sectionResource
    : value === 'passage'
      ? ResourceTypeEnum.passageResource
      : ResourceTypeEnum.projectResource;

interface IProps {
  media?: MediaFileD | undefined;
  uploadType?: UploadType | undefined;
  initCategory: string;
  initDescription: string;
  /** Controlled resource scope; parent owns this so radios stay in sync on remount. */
  resourceKind?: ResourceTypeEnum | undefined;
  onCategoryChange: (artifactCategoryId: string) => void;
  onDescriptionChange: (desc: string) => void;
  onPassResChange?: ((value: ResourceTypeEnum) => void) | undefined;
  onTextChange?: ((text: string) => void) | undefined;
  allowGeneralResourceOption: boolean;
  // TODO cleanup in next PR: every caller passes catRequired={false} and
  // catAllowNew={true}; hard-code them and drop the props.
  catRequired: boolean;
  catAllowNew?: boolean | undefined;
  // Forwarded to SelectArtifactCategory so the parent form can create a new
  // category at submission (rather than on blur).
  catCommitRef?: RefObject<(() => Promise<string>) | null> | undefined;
  wrapPreviewOverflow?: boolean;
}
export function ResourceData(props: IProps) {
  const {
    initCategory,
    initDescription,
    resourceKind = ResourceTypeEnum.sectionResource,
    onCategoryChange,
    onDescriptionChange,
    onPassResChange,
    catRequired,
    catAllowNew,
    allowGeneralResourceOption,
    media,
    uploadType,
    onTextChange,
    wrapPreviewOverflow,
    catCommitRef,
  } = props;
  // The TextField is uncontrolled (the parent owns the value via
  // onDescriptionChange); only emptiness is tracked here, for the error state,
  // so typing re-renders only when it flips. Callers remount (new dialog open)
  // to seed a different initDescription.
  const [hasDescription, setHasDescription] = useState(
    Boolean(initDescription.trim())
  );
  const { getOrganizedBy } = useOrganizedBy();
  const { section, passage } = usePassageDetailContext();
  const [text, setText] = useState(media?.attributes?.originalFile ?? '');
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  // Scope radio labels: Book/Movement sections and Note passages get their own wording.
  const sectionLevel = section?.attributes?.level;
  const sectionScopeLabel =
    sectionLevel === SheetLevel.Book
      ? t.bookResource
      : sectionLevel === SheetLevel.Movement
        ? t.movementResource
        : getOrganizedBy(true);
  const passageScopeLabel =
    passageTypeFromRef(passage?.attributes?.reference ?? undefined) ===
    PassageTypeEnum.NOTE
      ? t.noteResource
      : t.passageResource;
  const descriptionRequired = descriptionRequiredForResource(
    mediaContentType(media),
    uploadType,
    media?.attributes?.originalFile
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onPassResChange?.(radioToResourceKind(event.target.value));
  };
  const handleChangeDescription = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setHasDescription(Boolean(e.target.value.trim()));
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
            // Labeled "Title" for users, though it is stored in the description field.
            label={t.title}
            defaultValue={initDescription}
            onChange={handleChangeDescription}
            required={descriptionRequired}
            error={descriptionRequired && !hasDescription}
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
            value={resourceKindToRadio(resourceKind)}
            onChange={handleChange}
            name="radio-buttons-group"
          >
            <FormControlLabel
              value={'section'}
              control={<Radio />}
              label={t.currentResource.replace('{0}', sectionScopeLabel)}
            />
            <FormControlLabel
              value={'passage'}
              control={<Radio />}
              label={t.currentResource.replace('{0}', passageScopeLabel)}
            />
            {allowGeneralResourceOption &&
              ![
                ...NON_FILE_UPLOAD_TYPES,
                UploadType.PdfResource,
                UploadType.Graphic,
              ].includes(uploadType ?? UploadType.Resource) && (
                <FormControlLabel
                  value={'general'}
                  control={<Radio />}
                  label={t.uploadProject.replace('{0}', getOrganizedBy(false))}
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
