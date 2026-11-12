import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react';
import { Badge, Box, Stack } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { StyledTextAreaAutosize } from '../../../control/WebFontStyles';
import { Button, LightTooltip } from '../../../control';
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
import {
  orgDefaultFeatures,
  useOrgDefaults,
  getFontData,
  findRecord,
  useStepTool,
  pullTableList,
} from '../../../crud';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { isLangSet } from '../../../utils/langTag';
import { hasTranscriptionTask } from '../../../utils/namedSegments';
import { parseStepLanguageField } from '../../../crud/transcribeStepAsrSettings';
import type { FontData } from '../../../crud/fontChoice';
import type { BoldClauseTranscriptionConfig } from '../boldClauseTranscription';
import { useTranscriptionAutosave } from './useTranscriptionAutosave';
import { parseStepSettings, useBoldClauseAsr } from './useBoldClauseAsr';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import { useMobile } from '../../../utils/useMobile';
import { IWsAudioPlayerStrings } from '@model/index';
import Memory from '@orbit/memory';
import IndexedDBSource from '@orbit/indexeddb';
import JSONAPISource from '@orbit/jsonapi';

type TranscriptionStrings =
  ILwcTranscriptionStrings | ICarefulTranscriptionStrings;

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
  const [coordinator] = useGlobal('coordinator');
  const [errorReporter] = useGlobal('errorReporter');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const team = useMemo(
    () => teams.find((o) => o.id === organization),
    [teams, organization]
  );
  const { getOrgDefault } = useOrgDefaults();
  const features = getOrgDefault(orgDefaultFeatures) as
    { aiTranscribe?: boolean } | undefined;
  const { showMessage } = useSnackBar();
  const { isMobile } = useMobile();
  const checkOnline = useCheckOnline(tr.run);
  const { currentstep } = usePassageDetailContext();
  const { settings: stepSettings } = useStepTool(currentstep);
  const {
    asrSettings,
    asrIsoReady,
    asrLoadFailed,
    needsLanguagePicker,
    rememberStepAsr,
    stepAsr,
    asrTip,
  } = useBoldClauseAsr({
    transcriptionConfig,
    stepSettings,
    recognizeSpeech: tPlayer.recognizeSpeech,
  });
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

  // Resolve the transcription language and spell-check flag from the workflow
  // step settings (falling back to the project language for the font/lang),
  // then hand getFontData a synthetic project record so the textarea gets the
  // right lang/font and spellCheck. Spell check is driven solely by the step's
  // `spellCheck` flag: on when the step enables it, off otherwise (TT-7518).
  // getFontData always returns spellCheck:false, so the step value overrides it.
  useEffect(() => {
    if (!project) return;
    const projRec = findRecord(memory, 'project', project) as
      Project | undefined;
    if (!projRec) return;
    let cancelled = false;

    const lgSettings = parseStepSettings(stepSettings);
    const { bcp47: stepLang } = parseStepLanguageField(lgSettings?.language);
    const hasStepLanguage = isLangSet(stepLang);

    let langTag = hasStepLanguage ? stepLang : undefined;
    let defaultFont = lgSettings?.font;
    let rtl = lgSettings?.rtl ?? false;
    let defaultFontSize = lgSettings?.fontSize;
    if (!hasStepLanguage) {
      langTag = projRec.attributes?.language ?? langTag;
      defaultFont = defaultFont ?? projRec.attributes?.defaultFont ?? undefined;
      rtl = projRec.attributes?.rtl ?? rtl;
      defaultFontSize =
        defaultFontSize ?? projRec.attributes?.defaultFontSize ?? undefined;
    }

    const spellCheck = lgSettings?.spellCheck === true;

    const rec = {
      attributes: { language: langTag, defaultFont, defaultFontSize, rtl },
    } as Project;
    void getFontData(rec, artifactTypeId ?? 'project').then((data) => {
      if (!cancelled) setProjData({ ...data, spellCheck });
    });
    return () => {
      cancelled = true;
    };
  }, [project, memory, artifactTypeId, stepSettings]);

  // Cap growth so long transcriptions scroll inside the field (TT-7516),
  // matching Transcriber's fixed-height + overflow pattern.
  const textAreaStyle = useMemo(
    () =>
      ({
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: 120,
        maxHeight: 240,
        overflowY: 'auto',
        resize: 'none',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        wordBreak: 'normal',
        fontFamily: projData?.fontFamily,
        fontSize: projData?.fontSize,
        direction: projData?.fontDir,
      }) as CSSProperties,
    [projData]
  );

  const hasText = text.trim().length > 0;
  const hasAiTask = useMemo(
    () => hasTranscriptionTask(mediafile?.attributes?.segments),
    [mediafile]
  );
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
    (cancel: boolean, asrState?: IAsrState) => {
      setAsrLangVisible(false);
      if (cancel) return;
      const asr = asrState ?? asrSettings;
      if (!isLangSet(asr?.asrIso)) return;
      rememberStepAsr(asr);
      startAsr(asr);
    },
    [asrSettings, rememberStepAsr, startAsr]
  );

  const handleAsrClose = useCallback(() => {
    setAsrVisible(false);
    setAsrOverride(undefined);
    onAsrActiveChange(false);
  }, [onAsrActiveChange]);

  // The task id comes back on the media file. Pull it so leaving this step
  // and returning can resume the same transcription. The coordinator registers
  // 'remote' and 'backup' as these source types, as Transcriber also assumes.
  const onPullTasks = useCallback(
    (remoteMediaId: string) =>
      void pullTableList(
        'mediafile',
        [remoteMediaId],
        memory,
        coordinator?.getSource('remote') as JSONAPISource,
        coordinator?.getSource('backup') as IndexedDBSource,
        errorReporter
      ),
    [memory, coordinator, errorReporter]
  );

  const handleAutoTranslation = useCallback(() => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      if (hasAiTask) {
        startAsr();
        return;
      }
      if (needsLanguagePicker) {
        if (!asrIsoReady) {
          // A failed settings load is not a missing language; say which.
          showMessage(asrLoadFailed ? tr.asrRequestFailed : noLanguageMessage);
        }
        openAsrLanguageSettings();
        return;
      }
      startAsr();
    });
  }, [
    checkOnline,
    showMessage,
    ts.mustBeOnline,
    hasAiTask,
    startAsr,
    needsLanguagePicker,
    asrIsoReady,
    asrLoadFailed,
    tr.asrRequestFailed,
    noLanguageMessage,
    openAsrLanguageSettings,
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
            <LightTooltip
              title={<Badge badgeContent={ts.ai}>{asrTip ?? ''}</Badge>}
            >
              <span>
                <AsrButton
                  id={`${idPrefix}-asr`}
                  onClick={handleAutoTranslation}
                  onSettings={openAsrLanguageSettings}
                  settingsLabel={tPlayer.recognizeSpeechSettings}
                  disabled={runAsrDisabled}
                >
                  <TranscriptionLogo
                    disabled={runAsrDisabled}
                    sx={{ height: 18, width: 18, mr: 1 }}
                  />
                  {tr.aiAutomaticTranscription}
                </AsrButton>
              </span>
            </LightTooltip>
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
            <Button
              id={`${idPrefix}-next-clause`}
              color="primary"
              disabled={navigationDisabled}
              onClick={onNextClause}
            >
              {t.nextClause} &gt;
            </Button>
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
            onPullTasks={onPullTasks}
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
          stepAsr={stepAsr}
        />
      </BigDialog>
    </Box>
  );
}
