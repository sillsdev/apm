import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import { useArtifactType } from '../../crud/useArtifactType';
import type { ILanguage } from '../../control/Language';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { JSONParse } from '../../utils/jsonParse';
import { isLangSet } from '../../utils/langTag';
import { logError, Severity } from '../../utils/logErrorService';
import {
  isValidAsrLanguage,
  isoFromBcp47,
  needsSisterLanguage,
} from '../../business/asr/asrLanguages';
import { AsrTarget } from '../../business/asr/AsrTarget';
import type { ITranscriberStrings } from '../../model';
import { transcriberSelector } from '../../selector';
import {
  orgDefaultAsr,
  orgDefaultLangProps,
  useOrgDefaults,
} from '../../crud/useOrgDefaults';
import {
  artifactUsesOrgVernacularLanguage,
  buildVernacularAsrState,
  formatStepLanguageField,
  parseStepLanguageField,
  type TranscribeStepSettings as ITranscribeStepSettings,
} from '../../crud/transcribeStepAsrSettings';
import { IAsrState, normalizeAsrState } from '../../business/asr/asrState';
import { useSnackBar } from '../../hoc/useSnackBar';

const emptyLanguage = (): ILanguage => ({
  bcp47: 'und',
  languageName: '',
  font: '',
  rtl: false,
  spellCheck: false,
});

/**
 * Sister-language load, validity, and the team ASR default. The step form
 * renders them; this hook owns the requests so the two do not drift.
 */
export function useTranscribeStepAsr({
  org,
  toolSettings,
  onChange,
  primaryBcp47,
  currentSlug,
  clearMethod,
}: {
  org: string;
  toolSettings: string;
  onChange: (toolSettings: string) => void;
  primaryBcp47: string;
  currentSlug: string;
  clearMethod: (settings: Record<string, unknown>) => Record<string, unknown>;
}) {
  const [sisterLanguage, setSisterLanguage] =
    useState<ILanguage>(emptyLanguage);
  const sisterChangeRequest = useRef(0);
  const orgAsrSyncRequest = useRef(0);
  const { slugFromId } = useArtifactType();
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  const { showMessage } = useSnackBar();
  const [errorReporter] = useGlobal('errorReporter');
  const [offlineOnly] = useGlobal('offlineOnly');
  const token = useContext(TokenContext)?.state?.accessToken ?? null;
  const tt: ITranscriberStrings = useSelector(
    transcriberSelector,
    shallowEqual
  );

  const readVernacularFromOrg = useCallback(() => {
    if (!org) return emptyLanguage();
    return (
      (getOrgDefault(orgDefaultLangProps, org) as ILanguage | undefined) ??
      emptyLanguage()
    );
  }, [getOrgDefault, org]);

  const asrDefault: IAsrState = useMemo(
    () => ({
      target: AsrTarget.alphabet,
      language: {
        bcp47: 'und',
        languageName: 'unknown',
        font: 'charissil',
        rtl: false,
        spellCheck: false,
      },
      asrIso: 'eng',
      dialect: undefined,
      selectRoman: false,
    }),
    []
  );

  const vernacularAsrSettings = useCallback(
    (settingsJson: string): ITranscribeStepSettings => {
      const settings = JSONParse(settingsJson) as ITranscribeStepSettings;
      const phonetic = settings.phonetic ?? false;
      return {
        ...settings,
        phonetic,
        sisterlanguage:
          settings.sisterlanguage ?? formatStepLanguageField(sisterLanguage),
      };
    },
    [sisterLanguage]
  );

  const syncOrgAsrIfVernacular = useCallback(
    (settingsJson: string) => {
      if (!org) return;
      const settings = JSONParse(settingsJson) as ITranscribeStepSettings;
      const slug = slugFromId(
        settings.artifactTypeId?.toString() ?? ''
      ) as ArtifactTypeSlug;
      // Empty artifactTypeId is vernacular; Q&A/Retell also sync org ASR.
      if (settings.artifactTypeId && !artifactUsesOrgVernacularLanguage(slug)) {
        return;
      }
      // Without a token the ASR language can't be checked, and a guess written
      // here becomes the team default. Sync on the next edit made online.
      if (!token) return;
      const requestId = ++orgAsrSyncRequest.current;
      buildVernacularAsrState(
        vernacularAsrSettings(settingsJson),
        getOrgDefault,
        org,
        asrDefault,
        undefined,
        token
      )
        .then((asrState) => {
          if (requestId !== orgAsrSyncRequest.current) return;
          setOrgDefault(orgDefaultAsr, asrState, org);
        })
        .catch((err: unknown) => {
          if (requestId !== orgAsrSyncRequest.current) return;
          logError(
            Severity.error,
            errorReporter,
            err instanceof Error ? err : new Error(String(err))
          );
          showMessage(tt.asrSaveFailed);
        });
    },
    [
      org,
      slugFromId,
      getOrgDefault,
      setOrgDefault,
      asrDefault,
      vernacularAsrSettings,
      token,
      errorReporter,
      showMessage,
      tt.asrSaveFailed,
    ]
  );

  const emitSettingsChange = useCallback(
    (settingsJson: string) => {
      onChange(settingsJson);
      syncOrgAsrIfVernacular(settingsJson);
    },
    [onChange, syncOrgAsrIfVernacular]
  );

  useEffect(() => {
    if (!toolSettings) return;
    let cancelled = false;
    const json = JSON.parse(toolSettings);
    const slug = slugFromId(json.artifactTypeId);
    let sisterLang = parseStepLanguageField(json?.sisterlanguage);
    const report = (err: unknown) => {
      if (cancelled) return;
      logError(
        Severity.error,
        errorReporter,
        err instanceof Error ? err : new Error(String(err))
      );
      showMessage(tt.asrRequestFailed);
    };
    const applySister = () => {
      if (cancelled) return;
      setSisterLanguage((state) => ({
        ...state,
        languageName: sisterLang.languageName,
        bcp47: sisterLang.bcp47,
      }));
    };
    // Seed empty sister UI from org ASR when vernacular (or Q&A/Retell) needs a
    // sister language (e.g. Review step opened after Transcribe saved org ASR
    // but before peers synced).
    if (
      offlineOnly ||
      isLangSet(sisterLang.bcp47) ||
      !artifactUsesOrgVernacularLanguage(slug as ArtifactTypeSlug) ||
      !org ||
      token === null
    ) {
      applySister();
    } else {
      const vernacular = readVernacularFromOrg();
      needsSisterLanguage(vernacular?.bcp47 ?? 'und', token)
        .then((needed) => {
          if (cancelled || !needed) return;
          const orgAsr = normalizeAsrState(getOrgDefault(orgDefaultAsr, org));
          if (isLangSet(orgAsr?.language?.bcp47)) {
            sisterLang = {
              languageName: orgAsr.language.languageName ?? '',
              bcp47: orgAsr.language.bcp47 ?? 'und',
            };
          }
        })
        .catch(report)
        .then(applySister)
        .catch(report);
    }
    return () => {
      cancelled = true;
    };
    // slugFromId (from useArtifactType) is recreated every render, so listing it
    // here would re-run this initializer on every render and clobber in-progress
    // edits (e.g. the sister language the user just picked, before the change has
    // propagated back through toolSettings). Only re-sync when settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSettings]);

  const applySisterLanguage = (val: ILanguage) => {
    const bcp47 = val?.bcp47 ?? 'und';
    // The picker fires onChange once on mount with its initial (current) value.
    // Ignore that echo so opening the picker doesn't re-save the same language.
    if (
      bcp47 === (sisterLanguage?.bcp47 ?? 'und') &&
      (val?.languageName ?? '') === (sisterLanguage?.languageName ?? '')
    ) {
      return;
    }
    const requestId = ++sisterChangeRequest.current;
    const check = isLangSet(bcp47)
      ? isValidAsrLanguage(isoFromBcp47(bcp47), token)
      : Promise.resolve(true);
    check
      .then((valid) => {
        if (requestId !== sisterChangeRequest.current) return;
        if (!valid) {
          showMessage(tt.invalidSisterLang);
          setSisterLanguage(emptyLanguage());
          const json = clearMethod(
            JSONParse(toolSettings) as Record<string, unknown>
          );
          emitSettingsChange(
            JSON.stringify({
              ...json,
              sisterlanguage: formatStepLanguageField(emptyLanguage()),
              selectRoman: false,
            })
          );
          return;
        }
        setSisterLanguage(val);
        const json = clearMethod(
          JSONParse(toolSettings) as Record<string, unknown>
        );
        emitSettingsChange(
          JSON.stringify({
            ...json,
            sisterlanguage: formatStepLanguageField(val),
            selectRoman: false,
          })
        );
      })
      .catch((err: unknown) => {
        if (requestId !== sisterChangeRequest.current) return;
        logError(
          Severity.error,
          errorReporter,
          err instanceof Error ? err : new Error(String(err))
        );
        showMessage(tt.asrRequestFailed);
      });
  };

  const sisterSelectRoman = useMemo(() => {
    const json = JSONParse(toolSettings || '{}') as Record<string, unknown>;
    if (json && Object.hasOwn(json, 'selectRoman')) {
      return json.selectRoman === true || json.selectRoman === 'true';
    }
    // When sister UI was seeded from org ASR, also adopt its transliterate flag.
    if (
      artifactUsesOrgVernacularLanguage(currentSlug as ArtifactTypeSlug) &&
      org
    ) {
      const orgAsr = normalizeAsrState(getOrgDefault(orgDefaultAsr, org));
      return orgAsr?.selectRoman === true;
    }
    return false;
  }, [toolSettings, currentSlug, org, getOrgDefault]);

  const [showSisterLanguage, setShowSisterLanguage] = useState(false);
  useEffect(() => {
    if (offlineOnly) return;
    let cancelled = false;
    needsSisterLanguage(primaryBcp47, token)
      .then((needed) => {
        if (!cancelled) setShowSisterLanguage(needed);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError(
          Severity.error,
          errorReporter,
          err instanceof Error ? err : new Error(String(err))
        );
        showMessage(tt.asrRequestFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [
    offlineOnly,
    primaryBcp47,
    token,
    errorReporter,
    showMessage,
    tt.asrRequestFailed,
  ]);

  return {
    sisterLanguage,
    sisterSelectRoman,
    showSisterLanguage,
    emitSettingsChange,
    syncOrgAsrIfVernacular,
    applySisterLanguage,
  };
}
