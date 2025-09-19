import { useGlobal } from '../context/useGlobal';
import PassageTypeD, { PassageTypeEnum } from '../model/passageType';
import { remoteId } from './remoteId';
import { findRecord } from './tryFindRecord';
import { useSnackBar } from '../hoc/SnackBar';
import { RecordKeyMap } from '@orbit/records';

export const usePassageType = () => {
  const [memory] = useGlobal('memory');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const { showMessage } = useSnackBar();

  const getPassageTypeFromId = (id?: string) => {
    if (!id) return PassageTypeEnum.PASSAGE;
    const rec = findRecord(
      memory,
      'passagetype',
      id
    ) as unknown as PassageTypeD;
    if (rec) return rec.attributes.abbrev as PassageTypeEnum;
    return PassageTypeEnum.PASSAGE;
  };

  const getPassageTypeRec = (pt: PassageTypeEnum) => {
    if (pt !== PassageTypeEnum.PASSAGE) {
      let recs = memory.cache.query((q) =>
        q.findRecords('passagetype')
      ) as PassageTypeD[];
      recs = recs.filter(
        (r) =>
          r.attributes.abbrev === pt &&
          Boolean(
            remoteId(
              'passagetype',
              r.id as string,
              memory?.keyMap as RecordKeyMap
            )
          ) !== offlineOnly
      );
      if (recs?.length > 0) return recs[0];
    }
    return undefined;
  };
  const checkIt = (whereAmI: string) => {
    const len = (
      memory.cache.query((q) =>
        q.findRecords('passagetype')
      ) as unknown as PassageTypeD[]
    ).filter((p) => Boolean(p?.keys?.remoteId)).length;
    if (len > 5) showMessage(whereAmI + 'passagetype ' + len.toString());
  };
  return {
    getPassageTypeRec,
    getPassageTypeFromId,
    checkIt,
  };
};
