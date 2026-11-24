import type { ILanguage } from '../../control/Language';
import { initLang } from '../../control/initLang';
import { orgDefaultLangProps, useOrgDefaults } from '../../crud/useOrgDefaults';
import { useSetTeamLanguageForNewProject } from '../../crud/useSetTeamLanguage';

/**
 * The language a new project starts with, and remembering the one it was
 * created in. Desktop (AddCard) and mobile (ProjectsScreen) both add projects;
 * sharing this keeps the Language field pre-filled on both (TT-7802).
 */
export function useNewProjectLanguage(teamId?: string) {
  const { getOrgDefault } = useOrgDefaults();
  const setTeamLanguageForNewProject = useSetTeamLanguageForNewProject();

  /** Read when the dialog opens: org defaults are mutated in place. */
  const teamLanguage = (): ILanguage => {
    if (!teamId) return initLang;
    const language = getOrgDefault(orgDefaultLangProps, teamId) as
      ILanguage | undefined;
    return language ?? initLang;
  };

  const rememberLanguage = (language: ILanguage) => {
    if (teamId) setTeamLanguageForNewProject(language, teamId);
  };

  return { teamLanguage, rememberLanguage };
}
