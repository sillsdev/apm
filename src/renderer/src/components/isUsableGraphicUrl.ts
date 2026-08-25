/** Incomplete S3 keys like `graphics/333477_` 403; data/blob URLs are fine. */
export const isUsableGraphicUrl = (url?: string): boolean => {
  if (!url) return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return true;
  const file = url.split('?')[0].split('#')[0].split('/').pop() ?? '';
  return file.length > 0 && !/^\d+_?$/.test(file);
};
