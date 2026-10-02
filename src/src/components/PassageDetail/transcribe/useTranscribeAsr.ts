import { useMemo, useState, useCallback } from 'react';
import {
  OrganizationD,
  IWsAudioPlayerStrings,
  ISharedStrings,
} from '../../../model';
import { useGetAsrSettings } from '../../../crud/useGetAsrSettings';
import { useCheckOnline } from '../../../utils/useCheckOnline';
import { isLangSet } from '../../../utils/langTag';
import { useLocLangName } from '../../../utils/useLocLangName';
import { AsrTarget } from '../../../business/asr/AsrTarget';
import { IAsrState } from '../../../business/asr/asrState';

export interface UseTranscribeAsrProps {
  team: OrganizationD | undefined;
  sharedStr: ISharedStrings;
  tPlayer: IWsAudioPlayerStrings;
  showMessage: (msg: string) => void;
  onTextAdd: (text: string, isAsr?: boolean) => void;
  getCurrentText: () => string;
}

export function useTranscribeAsr({
  team,
  sharedStr,
  tPlayer,
  showMessage,
  onTextAdd,
  getCurrentText,
}: UseTranscribeAsrProps) {
  const { getAsrSettings, saveProjectAsrSettings, saveTeamAsrSettings } =
    useGetAsrSettings(team);
  const [getName] = useLocLangName();
  const checkOnline = useCheckOnline(tPlayer.recognizeSpeech);

  const [asrProgressVisible, setAsrProgressVisible] = useState(false);
  const [asrLangVisible, setAsrLangVisible] = useState(false);
  const [phonetic, setPhonetic] = useState(false);
  const [asrOverride, setAsrOverride] = useState<IAsrState | undefined>(
    undefined
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
      const asr = asrOverrideState ?? asrSettings;
      setAsrOverride(asrOverrideState);
      setPhonetic(asr?.target === AsrTarget.phonetic);
      setAsrProgressVisible(true);
    },
    [asrSettings]
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
      const cleanTrans = trans.replace(/[0-9]+:[0-9]+.[0-9]+: /g, '').trim();
      const curTrans = getCurrentText();
      if (curTrans.includes(cleanTrans)) return;
      const m = /\\v (\d+)\s?/.exec(cleanTrans);
      const index = m && curTrans.includes(m[0]) ? m[0].length : 0;
      const space = /\s$/.test(curTrans) ? '' : ' ';
      onTextAdd(space + cleanTrans.substring(index), true);
    },
    [getCurrentText, onTextAdd]
  );

  return {
    asrSettings,
    asrTip,
    asrProgressVisible,
    setAsrProgressVisible,
    asrLangVisible,
    setAsrLangVisible,
    asrOverride,
    phonetic,
    handleTranscribe,
    handleAsrLanguageClose,
    handleAutoTranscribe,
  };
}
