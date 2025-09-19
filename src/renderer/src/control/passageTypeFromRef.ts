import { PassageTypeEnum } from '../model/passageType';

/**
 * Returns the passage type corresponding to the provided reference value.
 * If the reference value is not provided or the `flat` parameter is set to `true`,
 * it returns the default passage type 'PASSAGE'.
 *
 * @param ref - A string representing a reference value.
 * @param flat - An optional boolean indicating whether the reference is coming
 * from a flat project.
 * @returns The passage type corresponding to the provided reference value. If the reference value is not provided
 * or the `flat` parameter is set to `true`, it returns the default passage type 'PASSAGE'.
 */
interface PtMap {
  [key: string]: PassageTypeEnum;
}
const typeMap: PtMap = {
  [PassageTypeEnum.MOVEMENT]: PassageTypeEnum.MOVEMENT,
  [PassageTypeEnum.CHAPTERNUMBER]: PassageTypeEnum.CHAPTERNUMBER,
  [PassageTypeEnum.BOOK]: PassageTypeEnum.BOOK,
  [PassageTypeEnum.ALTBOOK]: PassageTypeEnum.ALTBOOK,
  [PassageTypeEnum.NOTE]: PassageTypeEnum.NOTE,
  [PassageTypeEnum.PASSAGE]: PassageTypeEnum.PASSAGE,
};

export const passageTypeFromRef = (
  ref?: string,
  flat?: boolean
): PassageTypeEnum => {
  // If the `flat` parameter is `true` or the `ref` parameter is not provided, return the default passage type 'PASSAGE'.
  if (flat || !ref) {
    return PassageTypeEnum.PASSAGE;
  }

  // Find token at at beginning of reference.
  const refMatch = /^[A-Z]+/.exec(ref);
  if (!refMatch) {
    return PassageTypeEnum.PASSAGE;
  }
  const firstElement = refMatch[0];

  // Check if the first element exists in the `typeMap` object.
  if (Object.prototype.hasOwnProperty.call(typeMap, firstElement)) {
    // If it exists, return the corresponding passage type.
    return typeMap[firstElement];
  }

  // If it doesn't exist, return the default passage type 'PASSAGE'.
  return PassageTypeEnum.PASSAGE;
};

/**
 * Determines whether a given reference string corresponds to a passage type
 * which should just be recorded or not.
 *
 * @param ref - An optional string representing a reference.
 * @param flat - An optional boolean indicating whether the reference is coming
 * from a flat project.
 * @returns A boolean value indicating whether the given reference corresponds
 * to a passage type that will not follow the full workflow but rather just be
 * recorded.
 */
export const isPublishingTitle = (ref?: string, flat?: boolean): boolean => {
  const passageType = passageTypeFromRef(ref, flat);
  return (
    passageType !== PassageTypeEnum.PASSAGE &&
    passageType !== PassageTypeEnum.NOTE
  );
};
