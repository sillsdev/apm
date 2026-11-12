import { useMemo } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { findRecord, related } from '../../crud';
import { MediaFileD } from '../../model';

import { cleanFileName } from '../../utils';

interface IProps {
  mediafileId: string;
  commentNumber: number;
}

export const useRecordComment = ({ mediafileId, commentNumber }: IProps) => {
  const [memory] = useGlobal('memory');

  const passageId = useMemo(() => {
    const vernRec = findRecord(memory, 'mediafile', mediafileId) as MediaFileD;
    return related(vernRec, 'passage') as string;
  }, [mediafileId, memory]);

  const fileName = (subject: string, id: string) => {
    return `${cleanFileName(subject)}${(id + 'xxxx').slice(
      0,
      4
    )}-${commentNumber}`;
  };

  return { passageId, fileName };
};
