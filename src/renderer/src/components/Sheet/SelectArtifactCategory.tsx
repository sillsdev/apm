import {
  Autocomplete,
  Box,
  BoxProps,
  styled,
  SxProps,
  TextField,
} from '@mui/material';
import { useEffect, useRef, useState, type RefObject } from 'react';
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
  // When provided, the parent gets a `commit()` here to run at form submission:
  // it resolves the current input to a category id (creating a new category
  // when the typed name matches none) and returns it. New categories are then
  // created on commit rather than on blur.
  commitRef?: RefObject<(() => Promise<string>) | null> | undefined;
  // Fires as the user types in an allowNew field, i.e. whenever the field holds
  // text that only commit() will resolve to a category id. Parents that gate
  // their Save button on a "changed" flag would otherwise never enable it for a
  // new-category-only edit; they use this to mark themselves dirty.
  onNewDraft?: (() => void) | undefined;
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
    commitRef,
    onNewDraft,
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

  // Resolve a chosen/typed category name to an existing category id. Called on
  // blur and on change. Deliberately does NOT create new categories — that is
  // deferred to commit() (form submission) so navigating away without saving
  // never leaves an orphaned category behind.
  const resolveExisting = (raw: string | null) => {
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
    // allowNew + a new name: keep the typed text as-is and wait for commit().
  };

  // Resolve the current input to a category id, creating a new category when
  // the typed name matches none. Intended to run at form submission via
  // commitRef. Returns the resolved id (empty string when the field is blank).
  const commit = async (): Promise<string> => {
    const name = inputVal.trim();
    // Field unchanged from the committed category — keep its id as-is rather
    // than re-resolving by name. Re-resolving could silently drop the category
    // (when its localized name is filtered out of the options and the field
    // therefore shows blank) or switch it to a different id (when two slugs
    // share the same localized name). The empty === empty case also preserves
    // such a filtered-out category on an untouched save.
    if (name.toLowerCase() === currentName.trim().toLowerCase()) {
      return categoryId;
    }
    if (!name) {
      setCategory('');
      return '';
    }
    const existing = artifactCategorys.find(
      (c) => c.category.trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setCategory(existing.id);
      return existing.id;
    }
    if (!allowNew) {
      setInputVal(currentName);
      return categoryId;
    }
    if (committingRef.current) return categoryId;
    committingRef.current = true;
    try {
      const newId = await addNewArtifactCategory(name, type);
      const cats = await getCategorys();
      setArtifactCategorys(cats);
      if (newId && newId !== 'duplicate') {
        setCategory(newId);
        return newId;
      }
      const dup = cats.find(
        (c) => c.category.trim().toLowerCase() === name.toLowerCase()
      );
      if (dup) {
        setCategory(dup.id);
        return dup.id;
      }
      return categoryId;
    } finally {
      committingRef.current = false;
    }
  };

  // Expose commit() to the parent form. No dependency array: re-assign every
  // render so the closure stays current; clear on unmount so a stale commit is
  // never invoked once the field is gone.
  useEffect(() => {
    if (!commitRef) return;
    commitRef.current = commit;
    return () => {
      commitRef.current = null;
    };
  });

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
        onInputChange={(_e, v, reason) => {
          setInputVal(v);
          // A typed name isn't resolved to an id until commit(), so
          // onCategoryChange won't fire; tell the parent it's dirty so Save can
          // enable. Only real keystrokes count, not the programmatic 'reset' MUI
          // fires when the committed value changes; and without allowNew a typed
          // name is reverted on blur, so nothing was really edited.
          if (reason === 'input' && allowNew) onNewDraft?.();
        }}
        onChange={(_e, v) => resolveExisting(v)}
        onBlur={() => resolveExisting(inputVal)}
        sx={textFieldProps}
        renderOption={(liProps, option, { index }) => {
          const cat = artifactCategorys.find((c) => c.category === option);
          const isScr =
            scripture === ArtCatScr.highlight &&
            cat &&
            scriptureTypeCategory(cat.slug);
          return (
            // We already prevent duplicate categories, but include the render index just a fallback in case somehow two
            // categories end up with the same localized name in this particular language (shouldn't happen?)
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
        renderInput={(params) => {
          // The dropdown options carry the scripture-highlight info icon in
          // renderOption, but the collapsed field needs it too so the icon
          // stays visible once a scripture category is selected.
          const selectedCat = artifactCategorys.find(
            (c) => c.id === categoryId
          );
          const showScrIcon =
            scripture === ArtCatScr.highlight &&
            !!selectedCat &&
            scriptureTypeCategory(selectedCat.slug);
          return (
            <TextField
              {...params}
              id={idIn || 'artifact-category'}
              label={t.artifactCategory}
              required={required}
              variant="filled"
              fullWidth
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {showScrIcon && (
                        <LightTooltip title={t.scriptureHighlight}>
                          <InfoIcon fontSize="small" sx={{ mr: 0.5 }} />
                        </LightTooltip>
                      )}
                      {params.InputProps?.endAdornment}
                    </>
                  ),
                },
              }}
            />
          );
        }}
      />
    </StyledBox>
  );
};

export default SelectArtifactCategory;
