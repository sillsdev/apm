import { MediaFileD } from '@model/mediafile';
import { removeExtension } from './removeExtension';

const getMediaExt = (media: MediaFileD) => {
  return (
    removeExtension(media.attributes.originalFile)
      .ext?.split('?')[0]
      ?.toLowerCase() ?? ''
  );
};

export default getMediaExt;
