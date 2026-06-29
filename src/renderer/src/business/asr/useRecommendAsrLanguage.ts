import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { axiosGet } from '../../utils/axios';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import logError, { Severity } from '../../utils/logErrorService';

/**
 * A single ASR sister-language recommendation, mapped from the aero
 * `asr/recommend-language` response (see {@link parseSuggestions}).
 */
export interface IAsrLanguageSuggestion {
  /** Display name, e.g. "Lugbara". */
  languageName: string;
  /** ISO 639-3 code, e.g. "lgg". Used as the sister-language code. */
  iso: string;
  /** ASR methods supported for this language, e.g. ["mms", "omnilingual"]. */
  methods: string[];
  /** Human-readable explanation of why this language was suggested. */
  reason?: string;
  raw: unknown;
}

/** Shape of a single item in the recommend-language `recommendations` array. */
interface RecommendationItem {
  iso?: string;
  name?: string;
  methods?: string[];
  reason?: string;
}

/** Shape of the aero `asr/recommend-language` poll result. */
interface RecommendLanguageResponse {
  exact_match?: boolean;
  recommendations?: RecommendationItem[];
  user_language_profile?: unknown;
}

const POLL_DELAY = 2000; // 2 seconds

/**
 * Map the recommend-language payload into at most three suggestions. Logs the
 * raw data to aid debugging when the contract changes.
 */
const parseSuggestions = (data: unknown): IAsrLanguageSuggestion[] => {
  console.log('asr/recommend-language result', data);
  const { recommendations } = (data ?? {}) as RecommendLanguageResponse;
  if (!Array.isArray(recommendations)) return [];
  return recommendations.slice(0, 3).map((item) => ({
    languageName: item?.name ?? item?.iso ?? '',
    iso: item?.iso ?? '',
    methods: Array.isArray(item?.methods) ? item.methods : [],
    reason: item?.reason,
    raw: item,
  }));
};

const hasData = (data: unknown): boolean => {
  if (data == null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') return Object.keys(data).length > 0;
  return Boolean(data);
};

interface RecommendAsrLanguageResult {
  suggestions: IAsrLanguageSuggestion[];
  loading: boolean;
  /** True once a fetch/seed has completed (so callers can gate fallbacks). */
  attempted: boolean;
  error: string;
  /**
   * Start a recommend-language task for the given primary language ISO 639-3
   * code. `onResult` is invoked with the parsed suggestions once polling
   * completes (used to cache them in the step settings).
   */
  fetchRecommendations: (
    iso: string,
    onResult?: (suggestions: IAsrLanguageSuggestion[]) => void
  ) => Promise<void>;
  /** Populate suggestions from a cached source without querying the service. */
  seedSuggestions: (suggestions: IAsrLanguageSuggestion[]) => void;
  reset: () => void;
}

export function useRecommendAsrLanguage(): RecommendAsrLanguageResult {
  const [suggestions, setSuggestions] = useState<IAsrLanguageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const taskIdRef = useRef('');
  const token = useContext(TokenContext)?.state?.accessToken ?? undefined;
  const [errorReporter] = useGlobal('errorReporter');
  const waitingRef = useRef(false);
  const onResultRef = useRef<
    ((suggestions: IAsrLanguageSuggestion[]) => void) | undefined
  >(undefined);
  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    taskIdRef.current = '';
    setSuggestions([]);
    setError('');
    setLoading(false);
    setAttempted(false);
  }, [stop]);

  const poll = useCallback(async () => {
    if (waitingRef.current) return;
    waitingRef.current = true;
    try {
      const data = await axiosGet(
        `aero/transcription/asrsisters/${taskIdRef.current}`,
        undefined,
        token
      );
      console.log('transcription/asrsisters data', data);
      if (hasData(data)) {
        stop();
        const parsed = parseSuggestions(data);
        setSuggestions(parsed);
        setLoading(false);
        setAttempted(true);
        onResultRef.current?.(parsed);
      }
    } catch (err) {
      stop();
      logError(Severity.error, errorReporter, err as Error);
      setError((err as Error).message);
      setLoading(false);
      setAttempted(true);
    }
    waitingRef.current = false;
  }, [stop, token, errorReporter]);

  const seedSuggestions = useCallback(
    (cached: IAsrLanguageSuggestion[]) => {
      stop();
      taskIdRef.current = '';
      onResultRef.current = undefined;
      setError('');
      setLoading(false);
      setSuggestions(cached);
      setAttempted(true);
    },
    [stop]
  );

  const fetchRecommendations = useCallback(
    async (
      iso: string,
      onResult?: (suggestions: IAsrLanguageSuggestion[]) => void
    ) => {
      if (!iso) return;
      reset();
      onResultRef.current = onResult;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          iso: iso,
        });
        const response = (await axiosGet(
          `aero/transcription/asrsisters`,
          params,
          token
        )) as string;
        const taskId = response ?? '';
        if (!taskId) {
          setError('No task id returned for asr/recommend-language');
          setLoading(false);
          setAttempted(true);
          return;
        }
        taskIdRef.current = String(taskId);
        timerRef.current = setInterval(poll, POLL_DELAY);
      } catch (err) {
        logError(Severity.error, errorReporter, err as Error);
        setError((err as Error).message);
        setLoading(false);
        setAttempted(true);
      }
    },
    [poll, reset, token, errorReporter]
  );

  useEffect(() => stop, [stop]);

  return {
    suggestions,
    loading,
    attempted,
    error,
    fetchRecommendations,
    seedSuggestions,
    reset,
  };
}
