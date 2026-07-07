import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react';
import { Box, Stack } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { StyledTextAreaAutosize } from '../../../control/WebFontStyles';
import { PriButton } from '../../../control';
import AsrButton from '../../../control/ConfButton';
import TranscriptionLogo from '../../../control/TranscriptionLogo';
import AsrProgress from '../../../business/asr/AsrProgress';
import { AsrTarget } from '../../../business/asr/AsrTarget';
import SelectAsrLanguage from '../../../business/asr/SelectAsrLanguage';
import { asrStatesEqual, type IAsrState } from '../../../business/asr/asrState';
import { MediaFileD, OrganizationD, Project } from '@model/index';
import {
  carefulTranscriptionSelector,
  lwcTranscriptionSelector,
  sharedSelector,
  transcriberSelector,
  wsAudioPlayerSelector,
} from '../../../selector';
import {
  ICarefulTranscriptionStrings,
  ILwcTranscriptionStrings,
  ISharedStrings,
  ITranscriberStrings,
} from '@model/index';
import { useGlobal } from '../../../context/useGlobal';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { useCheckOnline } from '../../../utils/useCheckOnline';
import { useSnackBar } from '../../../hoc/SnackBar';
import { useBoldClauseTranscriptionAsrSettings } from '../../../crud/getLwcTranslationAsrSettings';
import {
  orgDefaultFeatures,
  useOrgDefaults,
  getFontData,
  findRecord,
  useStepTool,
} from '../../../crud';
import { useGetAsrSettings } from '../../../crud/useGetAsrSettings';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { isLangSet } from '../../../utils/langTag';
import type { FontData } from '../../../crud/fontChoice';
import type { BoldClauseTranscriptionConfig } from '../boldClauseTranscription';
import { useTranscriptionAutosave } from './useTranscriptionAutosave';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import { useMobile } from '../../../utils/useMobile';
import { IWsAudioPlayerStrings } from '@model/index';
import Memory from '@orbit/memory';

type TranscriptionStrings =
  | ILwcTranscriptionStrings
  | ICarefulTranscriptionStrings;

interface Props {
  width: number;
  mediafile: MediaFileD | undefined;
  text: string;
  onTextChange: (value: string) => void;
  memory: Memory;
  user: string;
  onNextClause: () => void;
  allClausesComplete: boolean;
  currentClauseTranscribed: boolean;
  navigationDisabled: boolean;
  onAsrActiveChange: (active: boolean) => void;
  onTranscriptionSaved: (transcription: string) => void;
  flushSaveRef?: MutableRefObject<(() => Promise<void>) | undefined>;
  artifactTypeId?: string | null;
  transcriptionConfig: BoldClauseTranscriptionConfig;
}

function useTranscriptionStrings(
  layout: BoldClauseTranscriptionConfig['stringsLayout']
): TranscriptionStrings {
  const lwc = useSelector(lwcTranscriptionSelector, shallowEqual);
  const careful = useSelector(carefulTranscriptionSelector, shallowEqual);
  return layout === 'carefulTranscription' ? careful : lwc;
}

export default function BoldClauseTranscriptionEditor({
  mediafile,
  text,
  onTextChange,
  memory,
  user,
  onNextClause,
  allClausesComplete,
  currentClauseTranscribed,
  navigationDisabled,
  onAsrActiveChange,
  onTranscriptionSaved,
  flushSaveRef,
  artifactTypeId,
  transcriptionConfig,
}: Props) {
  const t = useTranscriptionStrings(transcriptionConfig.stringsLayout);
  const tr: ITranscriberStrings = useSelector(
    transcriberSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tPlayer: IWsAudioPlayerStrings = useSelector(
    wsAudioPlayerSelector,
    shallowEqual
  );
  const [offline] = useGlobal('offline');
  const [project] = useGlobal('project');
  const [organization] = useGlobal('organization');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const team = useMemo(
    () => teams.find((o) => o.id === organization),
    [teams, organization]
  );
  const { saveProjectAsrSettings, saveTeamAsrSettings } =
    useGetAsrSettings(team);
  const { getOrgDefault } = useOrgDefaults();
  const features = getOrgDefault(orgDefaultFeatures) as
    | { aiTranscribe?: boolean }
    | undefined;
  const { showMessage } = useSnackBar();
  const { isMobile } = useMobile();
  const checkOnline = useCheckOnline(tr.run);
  const { currentstep } = usePassageDetailContext();
  const { settings: stepSettings } = useStepTool(currentstep);
  const { asrSettings, asrIsoReady, needsSisterLanguage } =
    useBoldClauseTranscriptionAsrSettings(
      transcriptionConfig.upstreamTool,
      transcriptionConfig.defaultArtifactSlug,
      stepSettings
    );
  const [asrVisible, setAsrVisible] = useState(false);
  const [asrLangVisible, setAsrLangVisible] = useState(false);
  const [asrOverride, setAsrOverride] = useState<IAsrState | undefined>();
  const [phonetic, setPhonetic] = useState(false);
  const [projData, setProjData] = useState<FontData | null>(null);
  const userEditedRef = useRef(false);

  const handleTextChange = useCallback(
    (value: string) => {
      userEditedRef.current = true;
      onTextChange(value);
    },
    [onTextChange]
  );

  const noLanguageMessage =
    transcriptionConfig.stringsLayout === 'carefulTranscription'
      ? (t as ICarefulTranscriptionStrings).noRecordingLanguage
      : (t as ILwcTranscriptionStrings).noLwcLanguage;

  const { flushSave } = useTranscriptionAutosave({
    toolId: transcriptionConfig.toolId,
    mediafile,
    text,
    memory,
    user,
    enabled: Boolean(mediafile),
    onSaved: onTranscriptionSaved,
    userEditedRef,
  });

  useEffect(() => {
    if (flushSaveRef) {
      flushSaveRef.current = flushSave;
    }
  }, [flushSave, flushSaveRef]);

  useEffect(() => {
    if (!project) return;
    const rec = findRecord(memory, 'project', project) as Project | undefined;
    if (!rec) return;
    let cancelled = false;
    void getFontData(rec, artifactTypeId ?? 'project').then((data) => {
      if (!cancelled) setProjData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [project, memory, artifactTypeId]);

  const textAreaStyle = useMemo(
    () =>
      ({
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: 120,
        fontFamily: projData?.fontFamily,
        fontSize: projData?.fontSize,
        direction: projData?.fontDir,
      }) as CSSProperties,
    [projData]
  );

  const hasText = text.trim().length > 0;
  const needsLanguagePicker = !asrIsoReady || needsSisterLanguage();
  const runAsrDisabled =
    navigationDisabled || hasText || !features?.aiTranscribe || offline;

  const openAsrLanguageSettings = useCallback(() => {
    setAsrLangVisible(true);
  }, []);

  const startAsr = useCallback(
    (override?: IAsrState) => {
      const asr = override ?? asrSettings;
      setAsrOverride(override);
      setPhonetic(asr?.target === AsrTarget.phonetic);
      setAsrVisible(true);
      onAsrActiveChange(true);
    },
    [asrSettings, onAsrActiveChange]
  );

  const handleAsrLanguageClose = useCallback(
    (cancel: boolean, asrState?: IAsrState, setAsTeamDefault?: boolean) => {
      setAsrLangVisible(false);
      if (cancel) return;
      const asr = asrState ?? asrSettings;
      if (!isLangSet(asr?.asrIso)) return;
      if (setAsTeamDefault) saveTeamAsrSettings(asr);
      else saveProjectAsrSettings(asr);
      startAsr(asr);
    },
    [asrSettings, saveProjectAsrSettings, saveTeamAsrSettings, startAsr]
  );

  const handleAsrClose = useCallback(() => {
    setAsrVisible(false);
    setAsrOverride(undefined);
    onAsrActiveChange(false);
  }, [onAsrActiveChange]);

  const handleAutoTranslation = useCallback(() => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      if (!asrIsoReady) {
        showMessage(noLanguageMessage);
        openAsrLanguageSettings();
        return;
      }
      if (needsSisterLanguage()) {
        openAsrLanguageSettings();
        return;
      }
      startAsr(asrSettings);
    });
  }, [
    checkOnline,
    showMessage,
    ts.mustBeOnline,
    asrIsoReady,
    noLanguageMessage,
    openAsrLanguageSettings,
    needsSisterLanguage,
    startAsr,
    asrSettings,
  ]);

  const handleAsrResult = useCallback(
    (transcription: string) => {
      userEditedRef.current = true;
      onTextChange(transcription);
    },
    [onTextChange]
  );

  const mediaId = mediafile?.id ?? '';
  const idPrefix = transcriptionConfig.idPrefix;

  return (
    <Box
      sx={{
        px: 2,
        pb: 2,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
      data-cy={`${idPrefix}-editor`}
    >
      <Stack spacing={1} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
        {features?.aiTranscribe && !offline && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <AsrButton
              id={`${idPrefix}-asr`}
              onClick={handleAutoTranslation}
              onSettings={openAsrLanguageSettings}
              showSettings={needsLanguagePicker}
              disabled={runAsrDisabled}
            >
              <TranscriptionLogo
                disabled={runAsrDisabled}
                sx={{ height: 18, width: 18, mr: 1 }}
              />
              {tr.aiAutomaticTranscription}
            </AsrButton>
          </Box>
        )}
        <StyledTextAreaAutosize
          id={`${idPrefix}-text`}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          readOnly={navigationDisabled}
          family={projData?.fontConfig?.custom?.families[0] ?? ''}
          url={projData?.fontConfig?.custom?.urls[0] ?? ''}
          overrides={textAreaStyle}
          lang={projData?.langTag || 'en'}
          spellCheck={projData?.spellCheck === true}
        />
        {currentClauseTranscribed && !allClausesComplete && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
            <PriButton
              id={`${idPrefix}-next-clause`}
              onClick={onNextClause}
              disabled={navigationDisabled}
            >
              {t.nextClause} &gt;
            </PriButton>
          </Box>
        )}
      </Stack>
      {asrVisible && mediaId && (
        <BigDialog
          title={tPlayer.recognizeProgress}
          isOpen={asrVisible}
          onOpen={(open) => {
            if (!open) handleAsrClose();
          }}
          bp={isMobile ? BigDialogBp.mobile : BigDialogBp.sm}
          mobileNoHorizontalScroll={isMobile}
          mobilePaperWidth={
            isMobile ? 'min(356px, calc(100vw - 4px))' : undefined
          }
          dialogContentSx={{ minWidth: 0, overflowX: 'hidden' }}
        >
          <AsrProgress
            mediaId={mediaId}
            phonetic={phonetic}
            asrState={asrOverride ?? asrSettings}
            force={
              asrOverride !== undefined &&
              !asrStatesEqual(asrOverride, asrSettings)
            }
            setTranscription={handleAsrResult}
            onPullTasks={() => undefined}
            onClose={handleAsrClose}
          />
        </BigDialog>
      )}
      <BigDialog
        title={tPlayer.recognizeSpeechSettings}
        isOpen={asrLangVisible}
        onOpen={() => handleAsrLanguageClose(true)}
        bp={isMobile ? BigDialogBp.mobile : BigDialogBp.sm}
        mobileNoHorizontalScroll={isMobile}
        mobilePaperWidth={
          isMobile ? 'min(356px, calc(100vw - 4px))' : undefined
        }
        dialogContentSx={{ minWidth: 0, overflowX: 'hidden' }}
      >
        <SelectAsrLanguage
          key={asrLangVisible ? 'open' : 'closed'}
          team={team}
          onClose={handleAsrLanguageClose}
        />
      </BigDialog>
    </Box>
  );
}
