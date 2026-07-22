import {
  Autocomplete,
  Box,
  BoxProps,
  styled,
  SxProps,
  TextField,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import {
  ArtifactCategoryType,
  IArtifactCategory,
  useArtifactCategory,
} from '../../crud/useArtifactCategory';
import { ArtifactCategory, ISelectArtifactCategoryStrings } from '../../model';
import InfoIcon from '@mui/icons-material/Info';
import { shallowEqual, useSelector } from 'react-redux';
import { LightTooltip } from '../../control';
import { selectArtifactCategory } from '../../selector';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useGlobal } from '../../context/useGlobal';
import { ArtCatScr } from './ArtCatScr';

interface IProps {
  id?: string | undefined;
  initCategory: string;
  onCategoryChange?: ((artifactCategoryId: string) => void) | undefined;
  required: boolean;
  allowNew?: boolean | undefined;
  scripture?: ArtCatScr | undefined;
  type: ArtifactCategoryType;
  disabled?: boolean | undefined;
}

const StyledBox = styled(Box)<BoxProps>(() => ({
  '& .MuiFormControl-root': {
    margin: 0,
  },
  display: 'flex',
  flexDirection: 'column',
}));

const textFieldProps = {
  mr: 1,
  width: 'inherit',
  maxWidth: '400px',
  minWidth: '200px',
} as SxProps;

export const SelectArtifactCategory = (props: IProps) => {
  const {
    id: idIn,
    onCategoryChange,
    allowNew,
    required,
    initCategory,
    scripture,
    type,
    disabled,
  } = props;
  const artifactCategories =
    useOrbitData<ArtifactCategory[]>('artifactcategory');
  const [categoryId, setCategoryId] = useState(initCategory);
  const [org] = useGlobal('organization');
  const t: ISelectArtifactCategoryStrings = useSelector(
    selectArtifactCategory,
    shallowEqual
  );
  const {
    getArtifactCategorys,
    scriptureTypeCategory,
    addNewArtifactCategory,
  } = useArtifactCategory(org);
  const [artifactCategorys, setArtifactCategorys] = useState<
    IArtifactCategory[]
  >([]);
  const [gettingCategories, setGettingCategories] = useState(true);
  const committingRef = useRef(false);
  const currentName =
    artifactCategorys.find((c) => c.id === categoryId)?.category ?? '';
  const [inputVal, setInputVal] = useState(currentName);

  useEffect(() => {
    if (!gettingCategories) setCategoryId(initCategory);
  }, [initCategory, gettingCategories]);

  // Keep the Autocomplete input text in sync with the committed category.
  useEffect(() => {
    setInputVal(currentName);
  }, [currentName]);

  const getCategorys = async () => {
    let cats = await getArtifactCategorys(type);
    if (scripture === ArtCatScr.hide)
      cats = cats.filter((c) => !scriptureTypeCategory(c.slug));
    return cats.filter((c) => (c.specialuse ?? '') === '');
  };

  useEffect(() => {
    getCategorys().then((cats) => {
      setArtifactCategorys(cats);
      setGettingCategories(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactCategories, scripture, org, type]);

  const setCategory = (id: string) => {
    setCategoryId(id);
    onCategoryChange && onCategoryChange(id);
  };

  // Resolve a chosen/typed category name to an id, creating a new category
  // when the name doesn't match an existing one.
  const resolveCommit = async (raw: string | null) => {
    const name = (raw ?? '').trim();
    if (name.toLowerCase() === currentName.trim().toLowerCase()) return;
    if (!name) {
      setCategory('');
      return;
    }
    const existing = artifactCategorys.find(
      (c) => c.category.trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setCategory(existing.id);
      return;
    }
    if (!allowNew) {
      // New categories aren't allowed and the typed text matches no existing
      // category, so revert the field to the committed value instead of
      // leaving an unsaved name showing.
      setInputVal(currentName);
      return;
    }
    if (committingRef.current) return;
    committingRef.current = true;
    try {
      const newId = await addNewArtifactCategory(name, type);
      const cats = await getCategorys();
      setArtifactCategorys(cats);
      if (newId && newId !== 'duplicate') {
        setCategory(newId);
      } else {
        const dup = cats.find(
          (c) => c.category.trim().toLowerCase() === name.toLowerCase()
        );
        if (dup) setCategory(dup.id);
      }
    } finally {
      committingRef.current = false;
    }
  };

  return (
    <StyledBox>
      <Autocomplete
        freeSolo
        size="small"
        disabled={disabled ?? false}
        options={artifactCategorys
          .map((c) => c.category)
          .filter(Boolean)
          .sort((a, b) => (a < b ? -1 : 1))}
        value={currentName || null}
        inputValue={inputVal}
        onInputChange={(_e, v) => setInputVal(v)}
        onChange={(_e, v) => resolveCommit(v)}
        onBlur={() => resolveCommit(inputVal)}
        sx={textFieldProps}
        renderOption={(liProps, option, { index }) => {
          const cat = artifactCategorys.find((c) => c.category === option);
          const isScr =
            scripture === ArtCatScr.highlight &&
            cat &&
            scriptureTypeCategory(cat.slug);
          return (
            // Include the render index so two categories that share a localized
            // name can't collide on the same React key.
            <li {...liProps} key={`${cat?.id ?? option}-${index}`}>
              {option}
              {isScr && (
                <LightTooltip title={t.scriptureHighlight}>
                  <InfoIcon fontSize="small" sx={{ ml: 1 }} />
                </LightTooltip>
              )}
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            id={idIn || 'artifact-category'}
            label={t.artifactCategory}
            required={required}
            variant="filled"
            fullWidth
          />
        )}
      />
    </StyledBox>
  );
};

export default SelectArtifactCategory;
