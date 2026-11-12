import { graphicImageUrl } from '../components/isUsableGraphicUrl';

/**
 * Display URL for a CompressedImages slot.
 * Custom uploads use data: (FileReader) or legacy raw base64; Library picks
 * store https CDN URLs (TT-7725) and must not get a data:/base64 wrapper.
 */
export function compressedImageDisplayUrl(img: {
  content?: string;
  type?: string;
  name?: string;
}): string {
  const content = img.content?.trim() ?? '';
  if (!content) return '';
  if (
    content.startsWith('data:') ||
    content.startsWith('blob:') ||
    /^https?:\/\//i.test(content)
  ) {
    return graphicImageUrl(img);
  }
  return `data:${img.type || 'image/png'};base64,${content}`;
}
