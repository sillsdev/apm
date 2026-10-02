import type { MediaFileD } from '@model/mediafile';
import { getBurritoMediaExportStem } from './burritoMediaFileStem';

describe('getBurritoMediaExportStem', () => {
  it('uses id-based stem for long text/* body (formatted text) content', () => {
    const body = '# Title\n\n'.repeat(30);
    const media = {
      type: 'mediafile',
      id: 'abc-123-uuid',
      keys: { remoteId: 'remote-xyz' },
      attributes: {
        originalFile: body,
        contentType: 'text/html',
      },
    } as unknown as MediaFileD;
    expect(getBurritoMediaExportStem(media)).toBe('text-remote-xyz');
  });

  it('keeps a real short filename from originalFile', () => {
    const media = {
      type: 'mediafile',
      id: 'm1',
      attributes: {
        originalFile: 'C:\\docs\\MyNotes.md',
        contentType: 'text/markdown',
      },
    } as unknown as MediaFileD;
    expect(getBurritoMediaExportStem(media)).toBe('MyNotes');
  });

  it('derives stem from URL path when originalFile is http(s)', () => {
    const media = {
      type: 'mediafile',
      id: 'm1',
      attributes: {
        originalFile: 'https://example.org/static/guide.pdf',
        contentType: 'application/pdf',
      },
    } as unknown as MediaFileD;
    expect(getBurritoMediaExportStem(media)).toBe('guide');
  });
});
