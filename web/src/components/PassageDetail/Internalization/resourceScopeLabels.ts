import { IPassageDetailArtifactsStrings, SheetLevel } from '../../../model';
import { PassageTypeEnum } from '../../../model/passageTypeEnum';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';

/**
 * Pure scope-label logic for section/passage resources, shared by the edit
 * dialog (PassageDetailArtifacts) and the add flow (AddResourceWizard) via
 * useResourceScopeLabels. Kept free of React/selector imports so it is directly
 * unit-testable (and so the hook's redux chain doesn't load here).
 */

type SectionLike = { attributes?: { level?: number | null } } | undefined;
type PassageLike = { attributes?: { reference?: string | null } } | undefined;

/** Book/Movement sections get their own label; everything else is "organized by". */
export const getSectionResourceType = (section: SectionLike) => {
  const level = section?.attributes?.level;
  if (level === SheetLevel.Book) return PassageTypeEnum.BOOK;
  if (level === SheetLevel.Movement) return PassageTypeEnum.MOVEMENT;
  return undefined;
};

export const sectionResourceDesc = (
  section: SectionLike,
  t: IPassageDetailArtifactsStrings,
  organizedBy: string
): string => {
  const type = getSectionResourceType(section);
  return type === PassageTypeEnum.BOOK
    ? t.bookResource
    : type === PassageTypeEnum.MOVEMENT
      ? t.movementResource
      : organizedBy;
};

export const passageResourceDesc = (
  passage: PassageLike,
  t: IPassageDetailArtifactsStrings
): string =>
  passageTypeFromRef(passage?.attributes?.reference ?? undefined) ===
  PassageTypeEnum.NOTE
    ? t.noteResource
    : t.passageResource;
