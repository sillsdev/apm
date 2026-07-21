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
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';
import { shallowEqual, useSelector } from 'react-redux';
import { LightTooltip, StyledMenuItem } from '../../control';
import { selectArtifactCategory } from '../../selector';
import { NewArtifactCategory } from './NewArtifactCategory';
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
  /** Render a free-solo Autocomplete (type to filter existing or add a new
   *  category) instead of the Select + "add new" menu item. */
  autocomplete?: boolean | undefined;
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
const menuProps = { width: 300 } as SxProps;
const smallTextProps = { fontSize: 'small' } as SxProps;

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
    // TODO should they all be autocomplete?
    autocomplete,
  } = props;
  const artifactCategories =
    useOrbitData<ArtifactCategory[]>('artifactcategory');
  const [categoryId, setCategoryId] = useState(initCategory);
  const [showNew, setShowNew] = useState(false);
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

  const categoryAdded = (newId: string) => {
    getCategorys().then((cats) => {
      setArtifactCategorys(cats);
      setCategoryId(newId);
      onCategoryChange && onCategoryChange(newId);
    });
    cancelNewCategory();
  };
  const cancelNewCategory = () => {
    setShowNew(false);
  };

  const handleArtifactCategoryChange = (e: any) => {
    if (e.target.value === t.addNewCategory) setShowNew(true);
    else {
      setCategoryId(e.target.value);
      onCategoryChange && onCategoryChange(e.target.value);
    }
  };

  const setCategory = (id: string) => {
    setCategoryId(id);
    onCategoryChange && onCategoryChange(id);
  };

  // Resolve a chosen/typed category name to an id for the Autocomplete path,
  // creating a new category when the name doesn't match an existing one.
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
    if (!allowNew || committingRef.current) return;
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
      {autocomplete ? (
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
          renderOption={(liProps, option) => {
            const cat = artifactCategorys.find((c) => c.category === option);
            const isScr =
              scripture === ArtCatScr.highlight &&
              cat &&
              scriptureTypeCategory(cat.slug);
            return (
              <li {...liProps} key={cat?.id ?? option}>
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
      ) : (
        <TextField
          id={idIn || 'artifact-category'}
          select
          label={t.artifactCategory}
          sx={textFieldProps}
          value={
            artifactCategorys.map((c) => c.id).includes(categoryId)
              ? categoryId
              : ''
          }
          onChange={handleArtifactCategoryChange}
          disabled={disabled ?? false}
          slotProps={{
            select: {
              MenuProps: {
                sx: menuProps,
              },
            },
            input: {
              sx: smallTextProps,
            },
            inputLabel: {
              sx: smallTextProps,
            },
          }}
          margin="normal"
          variant="filled"
          required={required}
        >
          {artifactCategorys
            .sort((i, j) => (i.category < j.category ? -1 : 1))
            .map((option: IArtifactCategory) => (
              <StyledMenuItem key={option.id} value={option.id}>
                {option.category + '\u00A0\u00A0'}
                {scripture === ArtCatScr.highlight ? (
                  scriptureTypeCategory(option.slug) ? (
                    <LightTooltip title={t.scriptureHighlight}>
                      <InfoIcon />
                    </LightTooltip>
                  ) : (
                    <></>
                  )
                ) : (
                  <></>
                )}
              </StyledMenuItem>
            ))
            .concat(
              // if not populated yet
              initCategory !== '' &&
                artifactCategorys.length > 0 &&
                artifactCategorys.findIndex(
                  (v: IArtifactCategory) => v.id === initCategory
                ) === -1 ? (
                <StyledMenuItem key={initCategory} value={initCategory}>
                  <></>
                </StyledMenuItem>
              ) : allowNew ? (
                <StyledMenuItem key={t.addNewCategory} value={t.addNewCategory}>
                  {t.addNewCategory + '\u00A0\u00A0'}
                  <AddIcon />
                </StyledMenuItem>
              ) : (
                <div key={'noNew'}></div>
              )
            )}
        </TextField>
      )}
      {showNew && (
        <NewArtifactCategory
          type={type}
          onAdded={categoryAdded}
          onCancelled={cancelNewCategory}
        />
      )}
    </StyledBox>
  );
};

export default SelectArtifactCategory;
