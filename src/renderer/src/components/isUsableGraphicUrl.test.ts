import { isUsableGraphicUrl } from './isUsableGraphicUrl';

test('rejects incomplete S3 graphic keys', () => {
  expect(
    isUsableGraphicUrl(
      'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_'
    )
  ).toBe(false);
  expect(isUsableGraphicUrl('data:image/png;base64,xx')).toBe(true);
  expect(
    isUsableGraphicUrl(
      'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_cat.png'
    )
  ).toBe(true);
});
