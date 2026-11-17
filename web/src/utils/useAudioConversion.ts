import { useEffect, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useSnackBar, AlertSeverity } from '../hoc/SnackBar';
import { ISharedStrings, IWsAudioPlayerStrings } from '../model';
import { sharedSelector, wsAudioPlayerSelector } from '../selector';
import { estimateAiSeconds, recordAiSample } from '../control/estimateAiTime';
import { useVoiceUrl } from '../crud/useVoiceUrl';
import { clipAudio, replaceAudioSegment } from './audioUtils';
import { AudioAiFunc, S3_POLL_MAX_WAIT_MS, useAudioAi } from './useAudioAi';
import { useCheckOnline } from './useCheckOnline';

interface Run {
  current: boolean;
  stop: () => void;
}

export interface AiProgress {
  startedAt: number;
  estimateSec: number;
}

export const useAudioConversion = () => {
  const { requestAudioAi } = useAudioAi();
  const voiceUrl = useVoiceUrl();
  const { showMessage } = useSnackBar();
  const t: IWsAudioPlayerStrings = useSelector(
    wsAudioPlayerSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const checkOnline = useCheckOnline('');
  const [progress, setProgress] = useState<AiProgress>();
  const runRef = useRef<Run | undefined>(undefined);

  // Stop polling when the player goes away.
  useEffect(() => () => runRef.current?.stop(), []);

  /** Resolves the audio with `range` run through `func`, or undefined if cancelled or failed. */
  const runAi = async (
    func: AudioAiFunc,
    audio: Blob,
    range: { start: number; end: number },
    failMessage: string,
    voice?: string
  ): Promise<Blob | undefined> => {
    const online = await new Promise<boolean>((resolve) =>
      checkOnline(resolve)
    );
    if (!online) {
      showMessage(ts.mustBeOnline);
      return undefined;
    }
    const run = { current: false } as Run;
    const cancelled = new Promise<undefined>((resolve) => {
      run.stop = () => {
        run.current = true;
        resolve(undefined);
      };
    });
    runRef.current = run;
    const startedAt = Date.now();
    const durationSec = range.end - range.start;
    setProgress({
      startedAt,
      estimateSec: estimateAiSeconds(
        func,
        durationSec,
        S3_POLL_MAX_WAIT_MS / 1000
      ),
    });

    const convert = async () => {
      const targetVoice = voice ? await voiceUrl(voice) : undefined;
      if (voice && !targetVoice) throw new Error(`no voice url for ${voice}`);
      const clip = await clipAudio(audio, range.start, range.end);
      const file = await new Promise<File>((resolve, reject) =>
        requestAudioAi({
          func,
          cancelRef: run,
          file: new File([clip], `${startedAt}ai.wav`, { type: 'audio/wav' }),
          targetVoice,
          cb: (result) =>
            result instanceof File ? resolve(result) : reject(result),
        }).catch(reject)
      );
      recordAiSample(func, {
        durationSec,
        totalMs: Date.now() - startedAt,
        at: startedAt,
      });
      return (await replaceAudioSegment(audio, range.start, range.end, file))
        .blob;
    };

    try {
      return await Promise.race([convert(), cancelled]);
    } catch {
      // useAudioAi logs the failure. A cancelled run has already settled.
      showMessage(failMessage, AlertSeverity.Error);
      return undefined;
    } finally {
      if (runRef.current === run) setProgress(undefined);
    }
  };

  /** Resolves the audio with `range` noise-reduced, or undefined if cancelled or failed. */
  const suppressNoise = (audio: Blob, range: { start: number; end: number }) =>
    runAi(AudioAiFunc.noiseRemoval, audio, range, t.noiseremovalFailed);

  /** Resolves the audio with `range` spoken in `voice`, or undefined if cancelled or failed. */
  const convertVoice = (
    audio: Blob,
    range: { start: number; end: number },
    voice: string
  ) =>
    runAi(
      AudioAiFunc.voiceConversion,
      audio,
      range,
      t.aiFailed
        .replace('{0}', voice)
        .replace('{1}', AudioAiFunc.voiceConversion),
      voice
    );

  const cancel = () => runRef.current?.stop();

  return { progress, suppressNoise, convertVoice, cancel };
};
