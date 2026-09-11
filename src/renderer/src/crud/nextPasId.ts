import { Section, PassageD } from '../model';
import Memory from '@orbit/memory';
import { passagesForSection } from './passagesForSection';
import { isPublishingTitle } from '../control/passageTypeFromRef';

/**
 * Next passage in section order (same target as {@link nextPasId}).
 * With `wrap` false, returns undefined past the last passage instead of
 * wrapping to the first.
 */
export const nextPassageRecord = (
  section: Section,
  curPass: string,
  memory: Memory,
  wrap = true
): PassageD | undefined => {
  const passages = passagesForSection(memory, section?.id).sort(
    (a, b) => a.attributes.sequencenum - b.attributes.sequencenum
  );
  const curIndex = passages.findIndex((p) => p.id === curPass);
  if (curIndex === -1) return undefined;
  for (let i = curIndex + 1; i < passages.length; i++) {
    const passRec = passages[i];
    if (!isPublishingTitle(passRec?.attributes?.reference, false)) {
      return passRec;
    }
  }
  if (!wrap) return undefined;
  for (let i = 0; i < passages.length; i++) {
    const passRec = passages[i];
    if (!isPublishingTitle(passRec?.attributes?.reference, false)) {
      return passRec;
    }
  }
  return undefined;
};

export const nextPasId = (
  section: Section,
  curPass: string,
  memory: Memory
) => {
  const passRec = nextPassageRecord(section, curPass, memory);
  return passRec?.keys?.remoteId || passRec?.id || '';
};
