import { shallowEqual, useSelector } from 'react-redux';
import {
  ITranscriberStrings,
  IWsAudioPlayerStrings,
  OrganizationD,
} from '../../../model';
import { playerSelector, transcriberSelector } from '../../../selector';
import Confirm from '../../AlertDialog';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import SelectAsrLanguage from '../../../business/asr/SelectAsrLanguage';
import AsrProgress from '../../../business/asr/AsrProgress';
import type { IAsrState } from '../../../business/asr/asrState';
import type { PendingAsr } from './useTranscribeAsr';

export interface TranscribeAsrDialogsProps {
  team: OrganizationD | undefined;
  mediaId: string;
  asrLangVisible: boolean;
  asrProgressVisible: boolean;
  phonetic: boolean;
  asrOverride: IAsrState | undefined;
  forceAsr: boolean;
  contentVerses?: string[];
  forceRefresh?: () => void;
  /** Language-dialog close; cancel=true when the shell dismisses. */
  onLanguageClose: (cancel: boolean, asrState?: IAsrState) => void;
  onProgressOpen: (open: boolean) => void;
  setTranscription: (text: string, withoutFilled?: string) => void;
  /** A result waiting for Replace or Insert; shows the prompt. */
  pendingAsr?: PendingAsr;
  onAsrReplace?: () => void;
  onAsrInsert?: () => void;
  bp: BigDialogBp;
  isMobile?: boolean;
}

/** Progress + language-settings dialogs for transcribe ASR. */
export function TranscribeAsrDialogs({
  team,
  mediaId,
  asrLangVisible,
  asrProgressVisible,
  phonetic,
  asrOverride,
  forceAsr,
  contentVerses = [],
  forceRefresh,
  onLanguageClose,
  onProgressOpen,
  setTranscription,
  pendingAsr,
  onAsrReplace,
  onAsrInsert,
  bp,
  isMobile = false,
}: Readonly<TranscribeAsrDialogsProps>) {
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const tPlayer: IWsAudioPlayerStrings = useSelector(
    playerSelector,
    shallowEqual
  );

  return (
    <>
      <BigDialog
        title={tPlayer.recognizeSpeechSettings}
        isOpen={asrLangVisible}
        onOpen={() => onLanguageClose(true)}
        bp={bp}
        mobileNoHorizontalScroll={isMobile}
        mobilePaperWidth={
          isMobile ? 'min(356px, calc(100vw - 4px))' : undefined
        }
        dialogContentSx={{ minWidth: 0, overflowX: 'hidden' }}
      >
        <SelectAsrLanguage
          key={asrLangVisible ? 'open' : 'closed'}
          team={team}
          onClose={onLanguageClose}
        />
      </BigDialog>
      {asrProgressVisible && (
        <BigDialog
          title={tPlayer.recognizeProgress}
          isOpen={asrProgressVisible}
          onOpen={onProgressOpen}
          bp={bp}
          mobileNoHorizontalScroll={isMobile}
          mobilePaperWidth={
            isMobile ? 'min(356px, calc(100vw - 4px))' : undefined
          }
          dialogContentSx={{ minWidth: 0, overflowX: 'hidden' }}
        >
          <AsrProgress
            mediaId={mediaId}
            phonetic={phonetic}
            asrState={asrOverride}
            force={forceAsr}
            contentVerses={contentVerses}
            setTranscription={setTranscription}
            forceRefresh={forceRefresh}
            onClose={() => onProgressOpen(false)}
          />
        </BigDialog>
      )}
      {pendingAsr && (
        // Dismissing inserts: it never discards the user's text (TT-7856).
        <Confirm
          text={t.asrReplaceExisting}
          yes={t.asrReplace}
          no={t.asrInsert}
          yesResponse={() => onAsrReplace?.()}
          noResponse={() => onAsrInsert?.()}
          primaryButton="no"
        />
      )}
    </>
  );
}
