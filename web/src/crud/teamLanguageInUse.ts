import { ProjectD } from '../model';
import { isLangSet } from '../utils/langTag';
import { related } from './related';

/**
 * True when one of the team's projects (not archived) is in the team's default
 * language. Creating a project in another language must not then replace the
 * team language: those projects still rely on it and on its ASR settings.
 */
export function teamLanguageInUse(
  projects: ProjectD[],
  teamId: string,
  teamBcp47: string | undefined
): boolean {
  if (!isLangSet(teamBcp47)) return false;
  return projects.some(
    (p) =>
      related(p, 'organization') === teamId &&
      !p.attributes?.dateArchived &&
      p.attributes?.language === teamBcp47
  );
}
