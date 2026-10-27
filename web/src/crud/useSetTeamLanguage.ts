import type { ILanguage } from '../control/Language';
import { useGlobal } from '../context/useGlobal';
import type { ProjectD } from '../model';
import { teamLanguageInUse } from './teamLanguageInUse';
import { normalizeAsrState } from '../business/asr/asrState';
import {
  orgDefaultAsr,
  orgDefaultLangProps,
  useOrgDefaults,
} from './useOrgDefaults';

const unsetLanguage = (): ILanguage => ({
  bcp47: 'und',
  languageName: '',
  font: '',
  rtl: false,
  spellCheck: false,
});

/**
 * The one way to change a team's default language. The team ASR language
 * (or sister), method and transliterate were chosen for the old language, so
 * a real change clears them; the transcription type is kept. With no ASR
 * language saved, transcription resolves the new team language again.
 */
export function useSetTeamLanguage() {
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();

  return (language: ILanguage, orgId?: string) => {
    const current = getOrgDefault(orgDefaultLangProps, orgId) as
      ILanguage | undefined;
    setOrgDefault(orgDefaultLangProps, language, orgId);
    if ((current?.bcp47 ?? 'und') === (language?.bcp47 ?? 'und')) return;
    const teamAsr = normalizeAsrState(getOrgDefault(orgDefaultAsr, orgId));
    if (!teamAsr) return;
    setOrgDefault(
      orgDefaultAsr,
      {
        ...teamAsr,
        language: unsetLanguage(),
        asrIso: 'und',
        asrMethod: undefined,
        selectRoman: false,
      },
      orgId
    );
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
