import { useMemo } from 'react';
import {
  Autocomplete,
  Box,
  createFilterOptions,
  TextField,
  Typography,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { vProjectSelector } from '../../../selector';
import { IState, IVProjectStrings } from '../../../model';
import {
  bibleLabel,
  CatalogBible,
  languageLabel,
  PUBLIC_DOMAIN,
  ReferenceText,
  toReferenceText,
} from '../../../business/referenceText/referenceText';

export interface ReferenceTextPickerProps {
  id: string;
  label: string;
  /** Catalog entries that have the Project Book. */
  bibles: CatalogBible[];
  /** Ids shown first, under "Used in this team". */
  usedIds: Set<string>;
  value?: ReferenceText;
  /** Id of the other picker's choice, which this one may not repeat. */
  excludeId?: string;
  disabled?: boolean;
  helperText?: string;
  onChange: (value: ReferenceText | undefined) => void;
}

/** A catalog entry with its labels in the UI language. */
interface Option {
  bible: CatalogBible;
  language: string;
  label: string;
  search: string;
}

const filterOptions = createFilterOptions<Option>({
  stringify: (o) => o.search,
});

// A saved snapshot whose entry left the catalog still has to be an option.
const fromSnapshot = (r: ReferenceText): CatalogBible => ({ ...r });

export function ReferenceTextPicker(props: ReferenceTextPickerProps) {
  const {
    id,
    label,
    bibles,
    usedIds,
    value,
    excludeId,
    disabled,
    helperText,
    onChange,
  } = props;
  const t: IVProjectStrings = useSelector(vProjectSelector, shallowEqual);
  const lang = useSelector((state: IState) => state.strings.lang);

  const options = useMemo(() => {
    const list = bibles.filter((b) => b.id !== excludeId);
    if (value && !list.some((b) => b.id === value.id))
      list.push(fromSnapshot(value));
    const languages = new Map<string, string>();
    const options = list.map((bible): Option => {
      let language = languages.get(bible.language);
      if (language === undefined) {
        language = languageLabel(bible, lang);
        languages.set(bible.language, language);
      }
      const label = bibleLabel(bible, lang);
      return {
        bible,
        language,
        label,
        search: [
          language,
          bible.languageEnglishName,
          bible.languageName,
          bible.language,
          bible.name,
          bible.englishName,
          bible.shortName,
        ]
          .filter(Boolean)
          .join(' '),
      };
    });
    const collator = new Intl.Collator(lang);
    const used = (o: Option) => usedIds.has(o.bible.id);
    // groupBy needs options sorted by group
    return options.sort(
      (a, b) =>
        Number(used(b)) - Number(used(a)) ||
        collator.compare(a.language, b.language) ||
        collator.compare(a.label, b.label)
    );
  }, [bibles, excludeId, usedIds, value, lang]);

  const selected = options.find((o) => o.bible.id === value?.id) ?? null;

  const licenseText = (license: string) => {
    if (!license) return t.licenseNotStated;
    return license === PUBLIC_DOMAIN ? t.publicDomain : license;
  };

  return (
    <Autocomplete
      id={id}
      options={options}
      value={selected}
      disabled={disabled}
      filterOptions={filterOptions}
      groupBy={(o) => (usedIds.has(o.bible.id) ? t.usedInTeam : o.language)}
      getOptionLabel={(o) => o.label}
      getOptionKey={(o) => o.bible.id}
      isOptionEqualToValue={(a, b) => a.bible.id === b.bible.id}
      onChange={(_e, o) => onChange(o ? toReferenceText(o.bible) : undefined)}
      renderOption={(liProps, o) => {
        const { key, ...otherProps } = liProps;
        const { bible } = o;
        return (
          <li key={key} {...otherProps}>
            <Box>
              <Typography>
                <span dir={bible.textDirection}>{bible.name}</span>
                {o.label !== bible.name && ` (${bible.englishName})`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {[
                  usedIds.has(bible.id) && o.language,
                  bible.shortName,
                  licenseText(bible.license),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="filled"
          label={label}
          helperText={helperText}
        />
      )}
      sx={{ flex: '1 1 300px' }}
    />
  );
}
