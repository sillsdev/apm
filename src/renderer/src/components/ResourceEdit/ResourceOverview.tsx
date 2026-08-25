import { Box, Divider, IconButton, Stack } from '@mui/material';
import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  ActionRow,
  AltButton,
  GrowingDiv,
  ILanguage,
  Language,
  LightTooltip,
  PriButton,
} from '../../control';
import {
  IDialog,
  IResourceStrings,
  ISharedStrings,
  ISheet,
  PassageD,
  SharedResourceD,
} from '../../model';
import { useSelector, shallowEqual } from 'react-redux';
import { sharedResourceSelector, sharedSelector } from '../../selector';
import Mode from '../../model/dialogMode';
import {
  ResourceCategory,
  ResourceDescription,
  ResourceKeywords,
  ResourceTerms,
  ResourceTitle,
  ResourceLink,
} from '.';
import { useGlobal } from '../../context/useGlobal';
import { orgDefaultResKw, useOrgDefaults } from '../../crud';
import { NoteTitle } from './NoteTitle';
import SearchIcon from '@mui/icons-material/Search';
import SelectNote from './SelectNote';
import { DialogModePartial } from './DialogModePartial';

export interface IResourceDialog {
  title: string;
  mediaId: string;
  description: string;
  bcp47: string;
  languageName: string;
  font: string;
  rtl: boolean;
  spellCheck: boolean;
  terms: string;
  keywords: string;
  linkurl: string;
  note: boolean;
  category: string;
  changed: boolean;
  ws: ISheet | undefined;
  onRecording: (isRecording: boolean) => void;
}

export interface IResourceState {
  state: IResourceDialog;
  setState?: Dispatch<SetStateAction<IResourceDialog>> | undefined;
}

interface IProps extends IDialog<IResourceDialog> {
  dialogmode: Mode | DialogModePartial;
  isNote: boolean;
  ws: ISheet | undefined;
  nameInUse?: (newName: string) => boolean;
  onDelete?: () => void;
  onLink?: (link: SharedResourceD) => Promise<void>;
  onUnlink?: () => Promise<void> | void;
  contentReadOnly?: boolean;
}

export default function ResourceOverview(props: IProps) {
  const {
    dialogmode,
    values,
    isOpen,
    isNote,
    ws,
    onOpen,
    onCommit,
    onCancel,
    onDelete,
    onLink,
    onUnlink,
    contentReadOnly,
  } = props;

  const [isDeveloper] = useGlobal('developer');
  const recording = useRef(false);
  // commit() handle for the category field; called at save so a newly typed
  // category is created on submission rather than on blur.
  const catCommitRef = useRef<(() => Promise<string>) | null>(null);
  const { getOrgDefault, setOrgDefault, canSetOrgDefault } = useOrgDefaults();
  const [findNote, setFindNote] = React.useState(false);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t: IResourceStrings = useSelector(sharedResourceSelector, shallowEqual);

  const onRecording = (isRecording: boolean) => {
    recording.current = isRecording;
  };

  const initState: IResourceDialog = React.useMemo(
    () => ({
      title: '',
      mediaId: '',
      description: '',
      bcp47: 'und',
      languageName: '',
      font: '',
      rtl: false,
      spellCheck: false,
      terms: '',
      keywords: '',
      linkurl: '',
      note: isNote,
      category: '',
      changed: false,
      ws: ws,
      onRecording,
    }),
    [ws, isNote]
  );

  const [state, setState] = React.useState({ ...initState });
  const { title, bcp47, keywords } = state;

  const updateTitleState = useMemo(
    () => (contentReadOnly || dialogmode === Mode.view ? undefined : setState),
    [dialogmode, contentReadOnly]
  );

  const updateState = useMemo(
    () =>
      contentReadOnly ||
      dialogmode === Mode.view ||
      dialogmode === DialogModePartial.titleOnly
        ? undefined
        : setState,
    [dialogmode, contentReadOnly]
  );

  useEffect(() => {
    setState(
      !values
        ? { ...initState }
        : { ...values, ws, onRecording, note: isNote, changed: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, isOpen, isNote, initState]);

  const handleClose = () => {
    if (onOpen) onOpen(false);
    if (onCancel) onCancel();
  };

  const handleAdd = async () => {
    // Create the category now (at save) if the user typed a new one; on blur it
    // was only resolved against existing categories.
    const category = catCommitRef.current
      ? await catCommitRef.current()
      : state.category;
    onCommit({ ...state, category });
  };

  const handleLanguageChange = (val: ILanguage) => {
    updateState &&
      updateState((state) => ({ ...state, ...val, changed: true }));
  };

  const handleDelete = () => {
    onDelete && onDelete();
  };

  React.useEffect(() => {
    if (canSetOrgDefault) {
      const allKw = getOrgDefault(orgDefaultResKw) as string | undefined;
      const allList = allKw?.split('|') || [];
      const kwList = keywords?.split('|') || [];
      const allSet = new Set(allList.concat(kwList));
      const newList = Array.from(allSet).sort().join('|');
      if (newList !== allKw) setOrgDefault(orgDefaultResKw, newList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywords, canSetOrgDefault]);

  const handleFind = (): void => {
    setFindNote(true);
  };

  const findClose = () => {
    setFindNote(false);
  };

  const handleSelect = async (sr: SharedResourceD[]) => {
    if (sr.length > 0 && onLink) {
      await onLink(sr[0] as SharedResourceD);
    }
  };

  return !findNote ? (
    <Box>
      <Stack spacing={2}>
        {isNote && dialogmode !== Mode.view ? (
          <NoteTitle state={state} setState={updateTitleState} />
        ) : (
          <ResourceTitle state={state} setState={updateTitleState} />
        )}
        <ResourceDescription state={state} setState={updateState} />
        <ResourceCategory
          state={{ ...state, note: isNote }}
          setState={updateState}
          commitRef={catCommitRef}
        />
        <ResourceKeywords state={state} setState={updateState} />
        {!isNote ? (
          <>
            <ResourceTerms state={state} setState={updateState} />
            <Language
              {...state}
              onChange={handleLanguageChange}
              hideSpelling
              hideFont
              disabled={
                contentReadOnly ||
                dialogmode === Mode.view ||
                dialogmode === DialogModePartial.titleOnly
              }
            />
          </>
        ) : (
          <ResourceLink state={state} setState={updateState} />
        )}
      </Stack>
      <Divider sx={{ mt: 2 }} />
      <ActionRow>
        {isNote && (
          <>
            <LightTooltip title={t.findNote}>
              <IconButton
                id="findNote"
                onClick={handleFind}
                disabled={
                  dialogmode === Mode.view ||
                  dialogmode === DialogModePartial.titleOnly
                }
              >
                <SearchIcon color="primary" />
              </IconButton>
            </LightTooltip>
            <GrowingDiv />
          </>
        )}
        {isDeveloper && (
          <>
            <AltButton id="delete" onClick={handleDelete}>
              {t.delete}
            </AltButton>
            <GrowingDiv />
          </>
        )}
        {contentReadOnly &&
          onUnlink &&
          dialogmode !== Mode.view &&
          dialogmode !== DialogModePartial.titleOnly && (
            <AltButton id="unlinkNote" onClick={() => onUnlink()}>
              {t.unlinkNote}
            </AltButton>
          )}
        <AltButton id="resCancel" onClick={handleClose}>
          {dialogmode === Mode.add ? ts.cancel : ts.close}
        </AltButton>
        {dialogmode !== Mode.view && !contentReadOnly && (
          <PriButton
            id="resSave"
            onClick={() => handleAdd()}
            disabled={
              title === '' ||
              (bcp47 === 'und' && !isNote) ||
              !state.changed ||
              recording.current
            }
          >
            {dialogmode === Mode.add ? t.add : ts.save}
          </PriButton>
        )}
      </ActionRow>
    </Box>
  ) : (
    <SelectNote
      passage={ws?.passage as PassageD}
      onOpen={findClose}
      onSelect={handleSelect}
    />
  );
}
