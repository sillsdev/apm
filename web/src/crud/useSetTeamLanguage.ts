import { useContext } from 'react';
import type { ILanguage } from '../control/Language';
import { TokenContext } from '../context/TokenProvider';
import { AsrTarget } from '../business/asr/AsrTarget';
import {
  isoFromBcp47,
  needsSisterLanguage,
} from '../business/asr/asrLanguages';
import { isLangSet } from '../utils/langTag';
import { initLang } from '../control/initLang';
import { useGlobal } from '../context/useGlobal';
import type { ProjectD } from '../model';
import { teamLanguageInUse } from './teamLanguageInUse';
import { normalizeAsrState } from '../business/asr/asrState';
import {
  orgDefaultAsr,
  orgDefaultLangProps,
  useOrgDefaults,
} from './useOrgDefaults';

/**
 * The one way to change a team's default language. The team ASR language
 * (or sister), method and transliterate were chosen for the old language, so
 * a real change clears them at once; the transcription type is kept. Then,
 * when the service can transcribe the new language, it becomes the team's ASR
 * language. When it needs a sister (or the check can't run), the ASR language
 * stays 'und' until one is picked.
 */
export function useSetTeamLanguage() {
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  const token = useContext(TokenContext)?.state?.accessToken ?? null;

  /** Save `language` as the team's ASR language if the service supports it. */
  const adoptIfSupported = (language: ILanguage, orgId?: string) => {
    if (!isLangSet(language?.bcp47) || !token) return;
    needsSisterLanguage(language.bcp47, token)
      .then((needed) => {
        if (needed) return;
        // Only while nothing has changed since: the same team language, and
        // no ASR language saved meanwhile (e.g. by Save as team default).
        const teamLang = getOrgDefault(orgDefaultLangProps, orgId) as
          ILanguage | undefined;
        if (teamLang?.bcp47 !== language.bcp47) return;
        const now = normalizeAsrState(getOrgDefault(orgDefaultAsr, orgId));
        if (now && isLangSet(now.asrIso)) return;
        setOrgDefault(
          orgDefaultAsr,
          {
            target: now?.target ?? AsrTarget.alphabet,
            dialect: now?.dialect,
            selectRoman: false,
            asrMethod: undefined,
            language,
            asrIso: isoFromBcp47(language.bcp47),
          },
          orgId
        );
      })
      // A failed check leaves 'und'; transcription resolves the team language.
      .catch(() => undefined);
  };

  return (language: ILanguage, orgId?: string) => {
    const current = getOrgDefault(orgDefaultLangProps, orgId) as
      ILanguage | undefined;
    setOrgDefault(orgDefaultLangProps, language, orgId);
    if ((current?.bcp47 ?? 'und') === (language?.bcp47 ?? 'und')) return;
    const teamAsr = normalizeAsrState(getOrgDefault(orgDefaultAsr, orgId));
    if (teamAsr) {
      setOrgDefault(
        orgDefaultAsr,
        {
          ...teamAsr,
          language: initLang,
          asrIso: 'und',
          asrMethod: undefined,
          selectRoman: false,
        },
        orgId
      );
    }
    adoptIfSupported(language, orgId);
  };
}

/**
 * Creating a project offers its language as the team language, but only when
 * no project of the team uses the current one: those projects rely on it and
 * on its ASR settings.
 */
export function useSetTeamLanguageForNewProject() {
  const { getOrgDefault } = useOrgDefaults();
  const setTeamLanguage = useSetTeamLanguage();
  const [memory] = useGlobal('memory');

  return (language: ILanguage, teamId?: string) => {
    if (teamId) {
      const teamLang = getOrgDefault(orgDefaultLangProps, teamId) as
        ILanguage | undefined;
      // One-off read when the project is created; no subscription needed.
      const projects = memory.cache.query((q) =>
        q.findRecords('project')
      ) as ProjectD[];
      if (teamLanguageInUse(projects, teamId, teamLang?.bcp47)) return;
    }
    setTeamLanguage(language, teamId);
  };
}
