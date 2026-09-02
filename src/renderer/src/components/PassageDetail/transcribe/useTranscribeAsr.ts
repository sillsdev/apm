import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  OrganizationD,
  IWsAudioPlayerStrings,
  ISharedStrings,
  MediaFileD,
  PassageD,
} from '../../../model';
import { useGetAsrSettings } from '../../../crud/useGetAsrSettings';
import { useCheckOnline } from '../../../utils/useCheckOnline';
import { isLangSet } from '../../../utils/langTag';
import { useLocLangName } from '../../../utils/useLocLangName';
import { AsrTarget } from '../../../business/asr/AsrTarget';
import { IAsrState, asrStatesEqual } from '../../../business/asr/asrState';
import {
  getSegments,
  getSortedRegions,
  NamedRegions,
} from '../../../utils/namedSegments';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { applyAsrTranscription } from './applyAsrTranscription';
import {
  deriveContentVerses,
  verseLabelsFromMarkVersesRegions,
} from './transcribeContentVerses';
import {
  applyVerseMarkerForRegionPosition,
  insertVerseMarkerAtRegionPosition,
  seedFirstVerseMarker,
} from './transcribeVerseMarkers';
import { IRegion } from '../../../crud/useWavesurferRegions';
import { asrDebug, asrDebugPreview } from '../../../business/asr/asrDebug';

export interface UseTranscribeAsrProps {
  team: OrganizationD | undefined;
  sharedStr: ISharedStrings;
  tPlayer: IWsAudioPlayerStrings;
  showMessage: (msg: string) => void;
  passage?: PassageD | undefined;
  mediafile?: MediaFileD | undefined;
  playerMediaId?: string | undefined;
  textValue: string;
  onTextReplace: (text: string) => void;
  toolChanged?: (toolId: string, changed: boolean) => void;
  toolId?: string;
  transcriptionRef?: React.RefObject<HTMLDivElement | null>;
}

export function useTranscribeAsr({
  team,
  sharedStr,
  tPlayer,
  showMessage,
  passage,
  mediafile,
  playerMediaId,
  textValue,
  onTextReplace,
  toolChanged,
  toolId,
  transcriptionRef,
}: UseTranscribeAsrProps) {
  const { getAsrSettings, saveProjectAsrSettings, saveTeamAsrSettings } =
    useGetAsrSettings(team);
  const [getName] = useLocLangName();
  const checkOnline = useCheckOnline(tPlayer.recognizeSpeech);
  const mediarecs = useOrbitData<MediaFileD[]>('mediafile');

  const [asrProgressVisible, setAsrProgressVisible] = useState(false);
  const [asrLangVisible, setAsrLangVisible] = useState(false);
  const [phonetic, setPhonetic] = useState(false);
  const [asrOverride, setAsrOverride] = useState<IAsrState | undefined>(
    undefined
  );

  const verseSegsRef = useRef<string>('');

  const sortedVerseRegions = useMemo(() => {
    const defaultSegments = mediafile?.attributes?.segments;
    if (!defaultSegments) return [] as IRegion[];
    return getSortedRegions(getSegments(NamedRegions.Verse, defaultSegments));
  }, [mediafile?.attributes?.segments]);

  const verseSegsJson = useMemo(() => {
    if (sortedVerseRegions.length === 0) return undefined;
    return JSON.stringify({ regions: JSON.stringify(sortedVerseRegions) });
  }, [sortedVerseRegions]);

  useEffect(() => {
    if (verseSegsJson) verseSegsRef.current = verseSegsJson;
  }, [verseSegsJson]);

  const verseLabels = useMemo(
    () =>
      verseLabelsFromMarkVersesRegions(
        sortedVerseRegions.map((r) => r.label ?? '').filter(Boolean)
      ),
    [sortedVerseRegions]
  );

  const contentVerses = useMemo(
    () => deriveContentVerses(textValue, verseLabels),
    [textValue, verseLabels]
  );

  const asrSettings = useMemo(() => getAsrSettings(), [getAsrSettings]);

  const asrTip = useMemo(() => {
    return (tPlayer.recognizeSpeech + '\u00A0\u00A0').replace(
      '{0}',
      asrSettings?.language?.languageName?.trim()
        ? `\u2039 ${
            getName(asrSettings?.language.bcp47) ||
            asrSettings?.language?.languageName
          } \u203A`
        : ''
    );
  }, [tPlayer.recognizeSpeech, asrSettings, getName]);

  const startAsr = useCallback(
    (asrOverrideState?: IAsrState) => {
      asrDebug('startAsr', {
        contentVerses,
        verseLabels,
        textPreview: asrDebugPreview(textValue),
        force: asrOverrideState
          ? !asrStatesEqual(asrOverrideState, asrSettings)
          : false,
      });
      setAsrOverride(asrOverrideState);
      setPhonetic(
        (asrOverrideState ?? asrSettings)?.target === AsrTarget.phonetic
      );
      setAsrProgressVisible(true);
    },
    [asrSettings, contentVerses, verseLabels, textValue]
  );

  const openAsrLanguageSettings = useCallback(() => {
    setAsrLangVisible(true);
  }, []);

  const handleTranscribe = useCallback(() => {
    checkOnline((online) => {
      if (!online) {
        showMessage(sharedStr.mustBeOnline);
        return;
      }
      if (isLangSet(asrSettings?.asrIso)) {
        startAsr(asrSettings);
        return;
      }
      openAsrLanguageSettings();
    });
  }, [
    checkOnline,
    showMessage,
    sharedStr.mustBeOnline,
    asrSettings,
    startAsr,
    openAsrLanguageSettings,
  ]);

  const handleAsrLanguageClose = useCallback(
    (cancel: boolean, asrState?: IAsrState, setAsTeamDefault?: boolean) => {
      setAsrLangVisible(false);
      if (cancel) return;
      const asr = asrState ?? asrSettings;
      if (isLangSet(asr?.asrIso)) {
        if (setAsTeamDefault) saveTeamAsrSettings(asr);
        else saveProjectAsrSettings(asr);
        startAsr(asr);
      }
    },
    [asrSettings, saveTeamAsrSettings, saveProjectAsrSettings, startAsr]
  );

  const handleAutoTranscribe = useCallback(
    (trans: string) => {
      asrDebug('handleAutoTranscribe', {
        chunkPreview: asrDebugPreview(trans),
        currentPreview: asrDebugPreview(textValue),
        contentVerses,
      });
      const updated = applyAsrTranscription(textValue, trans);
      asrDebug('handleAutoTranscribe result', {
        changed: updated !== textValue,
        updatedPreview: asrDebugPreview(updated),
      });
      if (updated !== textValue) {
        onTextReplace(updated);
        if (toolId && toolChanged) toolChanged(toolId, true);
      }
    },
    [textValue, onTextReplace, toolId, toolChanged, contentVerses]
  );

  const hasAiTasks = useMemo(() => {
    const mediaId = playerMediaId ?? mediafile?.id;
    const mediaRec = mediarecs.find((m) => m.id === mediaId);
    return (
      getSegments(
        NamedRegions.TRTask,
        mediaRec?.attributes?.segments || '{}'
      ) !== '{}'
    );
  }, [playerMediaId, mediafile?.id, mediarecs]);

  const hasTranscription = useMemo(
    () => textValue !== '' && verseLabels.length <= contentVerses.length,
    [textValue, verseLabels.length, contentVerses.length]
  );

  const seedVerseMarkersOnLoad = useCallback(() => {
    if (!sortedVerseRegions.length) return;
    const seeded = seedFirstVerseMarker(textValue, sortedVerseRegions);
    if (seeded !== textValue) {
      onTextReplace(seeded);
    }
  }, [sortedVerseRegions, textValue, onTextReplace]);

  const handleStartRegion = useCallback(
    (position: number) => {
      if (transcriptionRef?.current?.firstChild) {
        const textArea = transcriptionRef.current
          .firstChild as HTMLTextAreaElement;
        insertVerseMarkerAtRegionPosition(
          textArea,
          sortedVerseRegions,
          position
        );
        onTextReplace(textArea.value ?? '');
        return;
      }
      const updated = applyVerseMarkerForRegionPosition(
        textValue,
        sortedVerseRegions,
        position
      );
      if (updated !== textValue) onTextReplace(updated);
    },
    [sortedVerseRegions, textValue, onTextReplace, transcriptionRef]
  );

  const asrForce = !asrStatesEqual(asrOverride, asrSettings);

  return {
    asrSettings,
    asrTip,
    asrProgressVisible,
    setAsrProgressVisible,
    asrLangVisible,
    setAsrLangVisible,
    asrOverride,
    phonetic,
    asrForce,
    contentVerses,
    verseLabels,
    verseSegs: verseSegsRef.current,
    verseSegsJson,
    hasAiTasks,
    hasTranscription,
    handleTranscribe,
    handleAsrLanguageClose,
    handleAutoTranscribe,
    handleStartRegion,
    seedVerseMarkersOnLoad,
    startAsr,
    openAsrLanguageSettings,
    passage,
  };
}
