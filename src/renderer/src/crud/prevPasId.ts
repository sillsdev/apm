import { Section, PassageD } from '../model';
import Memory from '@orbit/memory';
import { related } from './related';
import { findRecord } from './tryFindRecord';
import { isPublishingTitle } from '../control/passageTypeFromRef';
import { RecordIdentity } from '@orbit/records';

/** Previous passage in section order (same target as {@link prevPasId}). */
export const prevPassageRecord = (
  section: Section,
  curPass: string,
  memory: Memory
): PassageD | undefined => {
  const passRecIds: RecordIdentity[] = related(section, 'passages');
  if (!Array.isArray(passRecIds)) return undefined;
  const passages: PassageD[] = passRecIds
    .map((p) => findRecord(memory, 'passage', p.id) as PassageD)
    .sort(
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
