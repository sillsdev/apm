import { shallowEqual, useSelector } from 'react-redux';
import { SIZELIMIT } from '../components/MediaUpload';
import { mediaTabSelector } from '../selector';
import { IMediaTabStrings } from '../model';
import imageCompression from 'browser-image-compression';
import { useGlobal } from '../context/useGlobal';
import { logError, Severity } from '../utils';
import { blobToBase64 } from './blobToBase64';

// Converting to/from Blob: https://stackoverflow.com/questions/68276368/javascript-convert-a-blob-object-to-a-string-and-back
// https://stackoverflow.com/questions/18650168/convert-blob-to-base64

export const ApmDim = 40;
export const Rights = 'rights';

export interface CompressedImages {
  name: string;
  content: string;
  type: string;
  dimension: number;
}

export interface IGraphicInfo {
  [key: string]: CompressedImages | string | undefined;
}

export interface CompressionProps {
  onFiles?: (files: File[]) => void;
  showMessage: (msg: string | React.JSX.Element) => void;
  dimension: number[];
  defaultFilename?: string;
  finish?: (images: CompressedImages[]) => void;
  onOpen?: (visible: boolean) => void;
}

export const useCompression = ({
  onFiles,
  showMessage,
  dimension,
  defaultFilename,
  finish,
  onOpen,
}: CompressionProps) => {
  const t: IMediaTabStrings = useSelector(mediaTabSelector, shallowEqual);
  const [errorReporter] = useGlobal('errorReporter');

  const fileReport = (imageFile: File | Blob, desc?: string) => {
    // console.log(`${desc} instance of Blob`, imageFile instanceof Blob);
    const value = imageFile.size / 1024 / 1024;
    console.log(
      `${desc} size ` +
        (value > 1
          ? `${value.toFixed(2)} MB`
          : `${(value * 1024).toFixed(2)} KB`)
    );
  };

  const showFile = (files: File[]) => {
    const options = {
      maxSizeMb: SIZELIMIT,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    };
    if (onFiles && files.length === 1) {
      try {
        imageCompression(files[0], options).then((compressedFile) => {
          onFiles([compressedFile]);
        });
      } catch {
        // ignore errors here
      }
    }
  };

  const sizedName = (name: string, size: number, ext: string | undefined) => {
    return ext && name.endsWith(ext)
      ? name.replace(`.${ext}`, `-${size}.${ext}`)
      : `${name}-${size}.${ext}`;
  };

  const uploadMedia = async (files: File[]) => {
    if (!files || files.length === 0) {
      showMessage(t.selectFiles);
      return;
    }

    const results: CompressedImages[] = [];
    const imageFile = files[0];
    fileReport(imageFile, 'Original');

    for (const dim of dimension) {
      const options = {
        maxSizeMb: SIZELIMIT,
        maxWidthOrHeight: dim,
        useWebWorker: true,
      };
      try {
        const compressedFile = await imageCompression(imageFile, options);
        fileReport(compressedFile, `Compressed ${dim}`);
        const ext = imageFile.name.split('.').pop();
        results.push({
          name: sizedName(defaultFilename || imageFile.name, dim, ext),
          content: (await blobToBase64(compressedFile)) as string,
          type: imageFile?.type,
          dimension: dim,
        });
      } catch (error) {
        logError(Severity.error, errorReporter, error as Error);
      }
    }
    if (finish) finish(results);
    onOpen?.(false);
  };

  return { showFile, uploadMedia };
};
