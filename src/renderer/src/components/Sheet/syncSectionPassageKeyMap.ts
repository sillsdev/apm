import Memory from '@orbit/memory';
import { InitializedRecord, RecordKeyMap } from '@orbit/records';
import { remoteId } from '../../crud';

interface SectionPassageSaveRec {
  id: string;
  issection: boolean;
}

/**
 * Populate keyMap from a sectionpassage bulk-update response when Orbit has not
 * yet mapped remote ids (TT-7416).
 */
export function syncSectionPassageKeyMap(
  memory: Memory,
  rec: InitializedRecord
): void {
  const keyMap = memory?.keyMap as RecordKeyMap | undefined;
  if (!keyMap || typeof keyMap.pushRecord !== 'function' || !rec?.id) {
    return;
  }

  if (rec.keys?.remoteId) {
    keyMap.pushRecord(rec);
  } else if (!remoteId('sectionpassage', rec.id, keyMap)) {
    keyMap.pushRecord({
      type: 'sectionpassage',
      id: rec.id,
      keys: { remoteId: `sp-remote-${rec.id}` },
    } as InitializedRecord);
  }

  const data = rec.attributes?.data;
  if (typeof data !== 'string') return;

  let outrecs: SectionPassageSaveRec[][];
  try {
    outrecs = JSON.parse(data);
  } catch {
    return;
  }

  outrecs.forEach((rowRec) => {
    rowRec.forEach((item) => {
      if (!item.id) return;
      const type = item.issection ? 'section' : 'passage';
      if (keyMap.keyToId(type, 'remoteId', item.id)) return;
      const localId = `${type}-local-${item.id}`;
      keyMap.pushRecord({
        type,
        id: localId,
        keys: { remoteId: item.id },
      } as InitializedRecord);
    });
  });
}
