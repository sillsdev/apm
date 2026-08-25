import { graphicImageUrl, isUsableGraphicUrl } from './isUsableGraphicUrl';

const incomplete =
  'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_';
const complete =
  'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_cat.png';

test('rejects incomplete S3 graphic keys', () => {
  expect(isUsableGraphicUrl(incomplete)).toBe(false);
  expect(isUsableGraphicUrl('data:image/png;base64,xx')).toBe(true);
  expect(isUsableGraphicUrl(complete)).toBe(true);
});

test('completes an S3 graphic key with the stored file name', () => {
  expect(graphicImageUrl({ content: complete, name: 'cat.png' })).toBe(
    complete
  );
  expect(graphicImageUrl({ content: incomplete, name: 'cat.png' })).toBe(
    complete
  );
  expect(graphicImageUrl({ content: incomplete })).toBe('');
});

test('completes an incomplete S3 key that has a query string', () => {
  const signed = `${incomplete}?X-Amz-Signature=abc`;
  expect(isUsableGraphicUrl(signed)).toBe(false);
  expect(graphicImageUrl({ content: signed, name: 'cat.png' })).toBe(
    `${complete}?X-Amz-Signature=abc`
  );
});

test('accepts a 1024 slot stored as a URL string', () => {
  expect(graphicImageUrl(complete)).toBe(complete);
  expect(graphicImageUrl(incomplete)).toBe('');
});

test('encodes hash in graphic S3 keys so the browser does not treat it as a fragment', () => {
  const hashed =
    'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_#Ttcat73691-1024.jpg';
  const encoded =
    'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_%23Ttcat73691-1024.jpg';
  expect(isUsableGraphicUrl(hashed)).toBe(true);
  expect(
    graphicImageUrl({
      content: hashed,
      name: '333477_#Ttcat73691-1024.jpg',
    })
  ).toBe(encoded);
});
