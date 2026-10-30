import { useEffect, useState } from 'react';
import { deviceVoices } from '../../../business/referenceText/voices';

export type DeviceVoices =
  { status: 'loading' } | { status: 'ready'; voices: SpeechSynthesisVoice[] };

/** This device's voices, kept current as the browser adds more (online voices can arrive late). */
export const useDeviceVoices = (): DeviceVoices => {
  const [state, setState] = useState<DeviceVoices>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const voices = await deviceVoices();
      if (!cancelled) setState({ status: 'ready', voices });
    };
    // deviceVoices never rejects; it resolves empty when there is no speech
    const handleVoicesChanged = () => void load();
    handleVoicesChanged();
    const synth = globalThis.speechSynthesis;
    synth?.addEventListener('voiceschanged', handleVoicesChanged);
    return () => {
      cancelled = true;
      synth?.removeEventListener('voiceschanged', handleVoicesChanged);
    };
  }, []);

  return state;
};
