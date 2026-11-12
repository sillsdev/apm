/** Incomplete S3 keys like `graphics/333477_` 403; data/blob URLs are fine. */
export const isUsableGraphicUrl = (url?: string): boolean => {
  if (!url) return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return true;
  // '#' is a filename char in graphic S3 keys, not a URL fragment
  const file = url.split('?')[0].split('/').pop() ?? '';
  return file.length > 0 && !/^\d+_?$/.test(file);
};

/** Browsers treat '#' as a fragment; graphic keys use '#' in the object name. */
const encodeGraphicPath = (url: string): string => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  const q = url.indexOf('?');
  const path = q < 0 ? url : url.slice(0, q);
  const query = q < 0 ? '' : url.slice(q);
  return path.replace(/#/g, '%23') + query;
};

/** Resolve a stored graphic image to a displayable URL. */
export const graphicImageUrl = (
  image?: { content?: string; name?: string } | string
): string => {
  if (typeof image === 'string') return graphicImageUrl({ content: image });
  const content = image?.content ?? '';
  if (isUsableGraphicUrl(content)) return encodeGraphicPath(content);
  const name = image?.name?.trim() ?? '';
  if (!name) return '';
  const q = content.indexOf('?');
  const base = q < 0 ? content : content.slice(0, q);
  const suffix = q < 0 ? '' : content.slice(q);
  if (!base.endsWith('_')) return '';
  const completed = `${base}${name}${suffix}`;
  return isUsableGraphicUrl(completed) ? encodeGraphicPath(completed) : '';
};
