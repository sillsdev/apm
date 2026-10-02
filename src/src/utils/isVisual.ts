import { MediaFile } from '../model';
import { mediaContentType } from './contentType';

export const isVisual = (m: MediaFile | undefined): boolean =>
  !/^audio/i.test(mediaContentType(m));
