import { apmGraphic } from './apmGraphic';
import { GraphicD } from '../model';

jest.mock('../utils/useCompression', () => ({
  ApmDim: 40,
  Rights: 'rights',
}));

const ApmDim = 40;

const rec = (info: Record<string, unknown>): GraphicD =>
  ({
    type: 'graphic',
    id: 'g1',
    attributes: { info: JSON.stringify(info) },
  }) as GraphicD;

const png = (content: string, dimension: number, name?: string) => ({
  name: name ?? `x-${dimension}.png`,
  content,
  type: 'image/png',
  dimension,
});

describe('apmGraphic', () => {
  const thumb = 'data:image/png;base64,thumb';
  const full = 'data:image/png;base64,full';

  it('uses the thumbnail when no full-size url is stored', () => {
    const gr = apmGraphic(
      rec({
        [String(ApmDim)]: png(thumb, ApmDim),
        rights: 'wycliffe',
      })
    );
    expect(gr?.graphicUri).toBe(thumb);
    expect(gr?.url).toBe('');
    expect(gr?.graphicRights).toBe('wycliffe');
  });

  it('completes an incomplete full-size S3 key using the file name', () => {
    const incomplete =
      'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_';
    const gr = apmGraphic(
      rec({
        '1024': png(incomplete, 1024, 'cat.png'),
        [String(ApmDim)]: png(thumb, ApmDim),
        rights: 'wycliffe',
      })
    );
    expect(gr?.url).toBe(
      'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_cat.png'
    );
  });

  it('prefers a usable full-size url over the thumbnail', () => {
    const gr = apmGraphic(
      rec({
        '1024': png(full, 1024),
        [String(ApmDim)]: png(thumb, ApmDim),
        rights: 'wycliffe',
      })
    );
    expect(gr?.url).toBe(full);
    expect(gr?.graphicUri).toBe(thumb);
  });

  it('encodes hash characters in the stored 1024 S3 key', () => {
    const hashed =
      'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_#Ttcat73691-1024.jpg';
    const gr = apmGraphic(
      rec({
        '1024': png(hashed, 1024, '333477_#Ttcat73691-1024.jpg'),
        [String(ApmDim)]: png(thumb, ApmDim),
        rights: 'wycliffe',
      })
    );
    expect(gr?.url).toBe(
      'https://sil-transcriber-userfiles-qa.s3.amazonaws.com/graphics/333477_%23Ttcat73691-1024.jpg'
    );
  });
});
