import { Section, PassageD } from '../model';
import Memory from '@orbit/memory';
import { related } from './related';
import { findRecord } from './tryFindRecord';
import { isPublishingTitle } from '../control/passageTypeFromRef';
import { RecordIdentity } from '@orbit/records';

export const prevPasId = (
  section: Section,
  curPass: string,
  memory: Memory
) => {
  let pasId = '';
  const passRecIds: RecordIdentity[] = related(section, 'passages');
  if (Array.isArray(passRecIds)) {
    const passages: PassageD[] = passRecIds
      .map((p) => findRecord(memory, 'passage', p.id) as PassageD)
      .sort(
        (a, b) =>
          (a?.attributes?.sequencenum ?? 0) - (b?.attributes?.sequencenum ?? 0)
      );
    let curIndex = passages.findIndex((p) => p.id === curPass);
    if (curIndex !== -1) {
      for (curIndex -= 1; curIndex >= 0; curIndex--) {
        const passRec = passages[curIndex];
        if (!isPublishingTitle(passRec?.attributes?.reference, false)) {
          pasId = passRec?.keys?.remoteId || passRec?.id;
          break;
        }
      }
      if (!pasId) {
        for (curIndex = passages.length - 1; curIndex >= 0; curIndex--) {
          const passRec = passages[curIndex];
          if (!isPublishingTitle(passRec?.attributes?.reference, false)) {
            pasId = passRec?.keys?.remoteId || passRec?.id;
            break;
          }
        }
      }
    }
  }
  return pasId;
};
