import { useState } from 'react';

// Per browser, not per team: online voices depend on the browser in use.
const SHOW_ONLINE_KEY = 'ttsShowOnlineVoices';

const readShowOnline = () => {
  try {
    return localStorage.getItem(SHOW_ONLINE_KEY) === 'true';
  } catch {
    // Storage can be blocked; online voices then start hidden.
    return false;
  }
};

/** Whether the voice dialog lists unranked online voices, remembered in this browser. */
export const useShowOnlineVoices = () => {
  const [showOnline, setShowOnlineState] = useState(readShowOnline);

  const setShowOnline = (value: boolean) => {
    setShowOnlineState(value);
    try {
      localStorage.setItem(SHOW_ONLINE_KEY, String(value));
    } catch {
      // Storage can be blocked; the choice then lasts until the dialog closes.
    }
  };

  return [showOnline, setShowOnline] as const;
};
