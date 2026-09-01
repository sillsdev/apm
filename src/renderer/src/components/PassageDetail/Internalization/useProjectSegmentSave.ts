import { useGlobal } from '../../../context/useGlobal';
import { MediaFile } from '../../../model';
import { UpdateAttribute } from '../../../model/baseModel';

interface IProps {
  media: MediaFile;
  segments: string;
}
export const useProjectSegmentSave = () => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');

  return async ({ media, segments }: IProps) => {
    await memory.update((t) => [
      ...UpdateAttribute(t, media as any, 'segments', segments, user),
    ]);
  };
};
