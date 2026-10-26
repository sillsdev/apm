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
import { useBoldClauseTranscriptionAsrSettings } from '../../../crud/getLwcTranslationAsrSettings';
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
import { getSegments, NamedRegions } from '../../../utils/namedSegments';
import { useLocLangName } from '../../../utils/useLocLangName';
import type { TranscribeStepSettingsJson } from '../../../crud/stepSpellCheck';
import { parseStepLanguageField } from '../../../crud/transcribeStepAsrSettings';
import type { FontData } from '../../../crud/fontChoice';
import type { BoldClauseTranscriptionConfig } from '../boldClauseTranscription';
import { useTranscriptionAutosave } from './useTranscriptionAutosave';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import { useMobile } from '../../../utils/useMobile';
import { IWsAudioPlayerStrings } from '@model/index';
import Memory from '@orbit/memory';
import IndexedDBSource from '@orbit/indexeddb';
import JSONAPISource from '@orbit/jsonapi';

function parseStepSettings(settings: unknown): TranscribeStepSettingsJson {
  if (!settings) return {};
  if (typeof settings === 'string') {
    try {
      return JSON.parse(settings) as TranscribeStepSettingsJson;
    } catch {
      return {};
    }
  }
  if (typeof settings === 'object') {
    return settings as TranscribeStepSettingsJson;
  }
  return {};
}

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
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
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
  const [getName] = useLocLangName();
  const { currentstep } = usePassageDetailContext();
  const { settings: stepSettings } = useStepTool(currentstep);
  const {
    asrSettings: resolvedAsr,
    asrIsoReady: resolvedAsrIsoReady,
    needsSisterLanguage: resolvedNeedsSister,
    asrLoadFailed,
    stepLanguageBcp47,
  } = useBoldClauseTranscriptionAsrSettings(
    transcriptionConfig.upstreamTool,
    transcriptionConfig.defaultArtifactSlug,
    stepSettings
  );
  // The dialog's choice for a step language (e.g. LWC translation), kept while
  // the editor is open so the dialog doesn't reopen on every clause. It isn't
  // saved: the saved project/team ASR defaults belong to the vernacular.
  const [stepAsrChoice, setStepAsrChoice] = useState<{
    forBcp47: string;
    asr: IAsrState;
  }>();
  const chosenStepAsr =
    stepLanguageBcp47 && stepAsrChoice?.forBcp47 === stepLanguageBcp47
      ? stepAsrChoice.asr
      : undefined;
  const asrSettings = chosenStepAsr ?? resolvedAsr;
  const asrIsoReady = chosenStepAsr ? true : resolvedAsrIsoReady;
  const needsSisterLanguage = useCallback(
    () => !chosenStepAsr && resolvedNeedsSister(),
    [chosenStepAsr, resolvedNeedsSister]
  );
  const asrTip = useMemo(() => {
    const step = parseStepSettings(stepSettings);
    const primary = parseStepLanguageField(step.language);
    const sister = parseStepLanguageField(step.sisterlanguage);
    const asrBcp = asrSettings?.language?.bcp47;
    const primaryBcp = isLangSet(primary.bcp47) ? primary.bcp47 : asrBcp;
    const primaryName = primaryBcp
      ? getName(primaryBcp) ||
        primary.languageName ||
        asrSettings?.language?.languageName
      : asrSettings?.language?.languageName;
    const usingSister =
      isLangSet(sister.bcp47) &&
      isLangSet(asrBcp) &&
      asrBcp === sister.bcp47 &&
      asrBcp !== primaryBcp;
    let langPart = primaryName?.trim()
      ? `\u2039 ${primaryName.trim()} \u203A`
      : '';
    if (usingSister) {
      const sisterName =
        getName(sister.bcp47) ||
        sister.languageName ||
        asrSettings?.language?.languageName;
      if (sisterName?.trim()) {
        langPart += `${langPart ? ' ' : ''}\u2039 ${sisterName.trim()} \u203A`;
      }
    }
    return (tPlayer.recognizeSpeech + '\u00A0\u00A0').replace('{0}', langPart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asrSettings, stepSettings, tPlayer.recognizeSpeech]);
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
    () =>
      getSegments(
        NamedRegions.TRTask,
        mediafile?.attributes?.segments || '{}'
      ) !== '{}',
    [mediafile]
  );
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
    (cancel: boolean, asrState?: IAsrState) => {
      setAsrLangVisible(false);
      if (cancel) return;
      const asr = asrState ?? asrSettings;
      if (!isLangSet(asr?.asrIso)) return;
      // Step-language ASR (e.g. LWC translation) is remembered for this editor
      // so the dialog reopens on it; the team ASR default belongs to the vernacular.
      if (stepLanguageBcp47) {
        setStepAsrChoice({ forBcp47: stepLanguageBcp47, asr });
      }
      startAsr(asr);
    },
    [asrSettings, stepLanguageBcp47, startAsr]
  );

  const stepAsr = useMemo(
    () =>
      stepLanguageBcp47
        ? { primaryBcp47: stepLanguageBcp47, asr: asrSettings }
        : undefined,
    [stepLanguageBcp47, asrSettings]
  );

  const handleAsrClose = useCallback(() => {
    setAsrVisible(false);
    setAsrOverride(undefined);
    onAsrActiveChange(false);
  }, [onAsrActiveChange]);

  const onPullTasks = useCallback(
    (remoteMediaId: string) => {
      // The task id comes back on the media file. Pull it so leaving this step
      // and returning can resume the same transcription.
      void pullTableList(
        'mediafile',
        [remoteMediaId],
        memory,
        remote,
        backup,
        errorReporter
      );
    },
    [memory, remote, backup, errorReporter]
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
