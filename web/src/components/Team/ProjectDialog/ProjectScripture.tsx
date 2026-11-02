import { useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  FormLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { vProjectSelector } from '../../../selector';
import { IState, IVProjectStrings, OptionType } from '../../../model';
import {
  biblesForBook,
  bookTestament,
  partitionByBook,
  projectBookToUsfm,
  ReferenceText,
  usfmToProjectBook,
} from '../../../business/referenceText/referenceText';
import { useBibleCatalog } from '../../../business/referenceText/useBibleCatalog';
import { useTeamReferenceTextIds } from '../../../business/referenceText/useTeamReferenceTextIds';
import {
  parseVoiceRanking,
  rankedLanguages,
  voiceLanguage,
} from '../../../business/referenceText/voiceRanking';
import {
  orgDefaultTtsFilterRefText,
  orgDefaultTtsVoices,
  useOrgDefaults,
} from '../../../crud/useOrgDefaults';
import { ReferenceTextPicker } from './ReferenceTextPicker';
import { IProjectDialogState } from './projectDialogTypes';

/** Project Book and Primary/Secondary Reference Texts for a Scripture project (ADR 0014). */
export function ProjectScripture(props: IProjectDialogState) {
  const { state, setState, team } = props;
  const t: IVProjectStrings = useSelector(vProjectSelector, shallowEqual);
  const bookSuggestions = useSelector(
    (s: IState) => s.books.suggestions,
    shallowEqual
  );
  const bookMap = useSelector((s: IState) => s.books.map, shallowEqual);
  const catalog = useBibleCatalog();
  const usedIds = useTeamReferenceTextIds(team);
  const { getOrgDefault } = useOrgDefaults();
  const [removedNames, setRemovedNames] = useState<string[]>([]);

  const usfm = projectBookToUsfm(state.book);
  const [primary, secondary] = state.referenceTexts;

  const bookOptions = useMemo(
    () => bookSuggestions.filter((o) => bookTestament(o.value)),
    [bookSuggestions]
  );
  // Languages the team ranked voices for, when it limits Reference Texts to them (ADR 0015).
  const voiceLanguages = useMemo(
    () => {
      if (!team || getOrgDefault(orgDefaultTtsFilterRefText, team) !== true)
        return undefined;
      const languages = rankedLanguages(
        parseVoiceRanking(getOrgDefault(orgDefaultTtsVoices, team))
      );
      return languages.size ? languages : undefined;
    },
    // getOrgDefault is recreated each render; the team's defaults only
    // change in the team dialog, never while this one is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team]
  );
  const bibles = useMemo(() => {
    if (catalog.status !== 'ready' || !usfm) return [];
    const forBook = biblesForBook(catalog.bibles, usfm);
    return voiceLanguages
      ? forBook.filter((b) => voiceLanguages.has(voiceLanguage(b.language)))
      : forBook;
  }, [catalog, usfm, voiceLanguages]);

  const handleBook = (opt: OptionType) => {
    const slot = usfmToProjectBook(opt.value);
    if (!slot || slot === state.book) return;
    const { kept, removed } = partitionByBook(state.referenceTexts, opt.value);
    setRemovedNames(removed.map((r) => r.name));
    setState((s) => ({ ...s, book: slot, referenceTexts: kept }));
  };

  const setReferenceTexts = (referenceTexts: ReferenceText[]) =>
    setState((s) => ({ ...s, referenceTexts }));

  const handlePrimary = (r?: ReferenceText) => {
    // Clearing Primary promotes Secondary.
    if (!r) setReferenceTexts(secondary ? [secondary] : []);
    else if (secondary && secondary.id !== r.id)
      setReferenceTexts([r, secondary]);
    else setReferenceTexts([r]);
  };

  const handleSecondary = (r?: ReferenceText) => {
    if (primary) setReferenceTexts(r ? [primary, r] : [primary]);
  };

  let pickerHelp: string | undefined;
  if (!usfm) pickerHelp = t.chooseBookFirst;
  else if (catalog.status === 'loading') pickerHelp = t.loadingBibles;

  return (
    <Stack sx={{ pt: 1 }} spacing={1}>
      <FormLabel sx={{ color: 'secondary.light' }}>{t.book}</FormLabel>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Autocomplete
          id="project-book"
          options={bookOptions}
          // A general code or empty book shows as unpicked; once a book is chosen
          // it can only be changed, because '' would remove the publishing book rows.
          value={
            (bookOptions.find((o) => o.value === usfm) ?? null) as OptionType
          }
          disableClearable
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(a, b) => a.value === b.value}
          onChange={(_e, opt) => handleBook(opt)}
          renderInput={(params) => (
            <TextField {...params} variant="filled" label={t.book} />
          )}
          sx={{ flex: '0 1 200px' }}
        />
        <ReferenceTextPicker
          id="primary-reference-text"
          label={t.primaryReferenceText}
          bibles={bibles}
          usedIds={usedIds}
          value={primary}
          disabled={!usfm || catalog.status !== 'ready'}
          helperText={pickerHelp}
          onChange={handlePrimary}
        />
        <ReferenceTextPicker
          id="secondary-reference-text"
          label={t.secondaryReferenceText}
          bibles={bibles}
          usedIds={usedIds}
          value={secondary}
          excludeId={primary?.id}
          disabled={!primary || catalog.status !== 'ready'}
          onChange={handleSecondary}
        />
      </Box>
      {voiceLanguages && usfm && (
        <Typography variant="caption" color="text.secondary">
          {t.filteredToVoices}
        </Typography>
      )}
      {catalog.status === 'error' && (
        <Alert severity="error">{t.bibleListError}</Alert>
      )}
      {removedNames.length > 0 && usfm && (
        <Alert severity="info" onClose={() => setRemovedNames([])}>
          {t.referenceTextRemoved
            .replace('{0}', removedNames.join(', '))
            .replace('{1}', bookMap[usfm] ?? usfm)}
        </Alert>
      )}
    </Stack>
  );
}
