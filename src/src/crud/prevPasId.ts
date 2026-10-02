import { Section, PassageD } from '../model';
import Memory from '@orbit/memory';
import { passagesForSection } from './passagesForSection';
import { isPublishingTitle } from '../control/passageTypeFromRef';

/**
 * Previous passage in section order (same target as {@link prevPasId}).
 * With `wrap` false, returns undefined before the first passage instead of
 * wrapping to the last.
 */
export const prevPassageRecord = (
  section: Section,
  curPass: string,
  memory: Memory,
  wrap = true
): PassageD | undefined => {
  const passages = passagesForSection(memory, section?.id).sort(
    (a, b) =>
      (a?.attributes?.sequencenum ?? 0) - (b?.attributes?.sequencenum ?? 0)
  );
  const curIndex = passages.findIndex((p) => p.id === curPass);
  if (curIndex === -1) return undefined;
  for (let i = curIndex - 1; i >= 0; i--) {
    const passRec = passages[i];
    if (!isPublishingTitle(passRec?.attributes?.reference, false)) {
      return passRec;
    }
  }
  if (!wrap) return undefined;
  for (let i = passages.length - 1; i >= 0; i--) {
    const passRec = passages[i];
    if (!isPublishingTitle(passRec?.attributes?.reference, false)) {
      return passRec;
    }
  }
  return undefined;
};

export const prevPasId = (
  section: Section,
  curPass: string,
  memory: Memory
) => {
  const passRec = prevPassageRecord(section, curPass, memory);
  return passRec?.keys?.remoteId || passRec?.id || '';
};
