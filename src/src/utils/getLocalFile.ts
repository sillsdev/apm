function getFileBlob(url: string, cb: (response: Blob) => void): void {
  let xhr = new XMLHttpRequest();
  const cleanup = (): void => {
    xhr.onload = null;
    xhr.onerror = null;
    xhr.onabort = null;
    // @ts-ignore free up memory by making xhr null
    xhr = null;
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.onload = () => {
    cb(xhr.response);
    cleanup();
  };
  xhr.send();
}

const blobToFile = (blob: Blob, name: string, mimeType: string): File => {
  return new File([blob], name, {
    type: mimeType,
  });
};

export const getFileObject = (
  filePathOrUrl: string,
  name: string,
  mimeType: string,
  cb: (f: File) => void
): void => {
  getFileBlob(filePathOrUrl, (blob): void => {
    cb(blobToFile(blob, name, mimeType));
  });
};
