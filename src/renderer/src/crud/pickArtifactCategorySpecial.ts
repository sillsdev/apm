import { ArtifactCategoryD } from '../model';
import { related } from './related';

/** Prefer remoteId, then slug===specialuse, then richer settings, then stable id. */
export const pickSpecialWinner = (
  group: ArtifactCategoryD[]
): ArtifactCategoryD => {
  return [...group].sort((a, b) => {
    const aR = a.keys?.remoteId ? 0 : 1;
    const bR = b.keys?.remoteId ? 0 : 1;
    if (aR !== bR) return aR - bR;
    const aSu = a.attributes?.specialuse ?? '';
    const bSu = b.attributes?.specialuse ?? '';
    const aSlug = aSu && a.attributes?.categoryname === aSu ? 0 : 1;
    const bSlug = bSu && b.attributes?.categoryname === bSu ? 0 : 1;
    if (aSlug !== bSlug) return aSlug - bSlug;
    const aRich =
      (a.attributes?.color ? 1 : 0) + (related(a, 'titleMediafile') ? 1 : 0);
    const bRich =
      (b.attributes?.color ? 1 : 0) + (related(b, 'titleMediafile') ? 1 : 0);
    if (bRich !== aRich) return bRich - aRich;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
};

/**
 * Canonical note special for a specialuse: prefer team (same org) over system,
 * then pickSpecialWinner among that set. Used by consolidate and CHNUM lookup.
 */
export const canonicalNoteSpecial = (
  cats: ArtifactCategoryD[],
  specialuse: string,
  orgId: string | undefined | null
): ArtifactCategoryD | undefined => {
  const matches = cats.filter(
    (c) => (c.attributes?.specialuse ?? '') === specialuse
  );
  if (matches.length === 0) return undefined;

  const team = orgId
    ? matches.filter((c) => related(c, 'organization') === orgId)
    : [];
  if (team.length > 0) return pickSpecialWinner(team);

  const system = matches.filter((c) => related(c, 'organization') == null);
  if (system.length > 0) return pickSpecialWinner(system);

  return pickSpecialWinner(matches);
};
