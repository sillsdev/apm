import type { MediaFileD } from '../../../model';
import { generalResourceMedia } from './generalResourceMedia';

const relationship = (type: string, id: string) => ({
  data: { type, id },
});

const media = (
  id: string,
  { sourceId, typeId }: { sourceId?: string; typeId?: string } = {}
): MediaFileD =>
  ({
    type: 'mediafile',
    id,
    attributes: {},
    relationships: {
      ...(sourceId ? { sourceMedia: relationship('mediafile', sourceId) } : {}),
      ...(typeId ? { artifactType: relationship('artifacttype', typeId) } : {}),
    },
  }) as MediaFileD;

describe('generalResourceMedia', () => {
  it('resolves a derived copy to its general resource source', () => {
    const source = media('source', { typeId: 'proj-type' });
    const copy = media('copy', { sourceId: 'source', typeId: 'resource' });

    expect(generalResourceMedia(copy, [source, copy], ['proj-type'])).toBe(
      source
    );
  });

  it('matches either the offline or remote projectresource type id', () => {
    const source = media('source', { typeId: 'proj-type-remote' });
    const copy = media('copy', { sourceId: 'source', typeId: 'resource' });

    // The single current-mode id would miss a source carrying the other copy's
    // type id; passing both ids resolves it (Edit/Delete now agree with the label).
    expect(
      generalResourceMedia(
        copy,
        [source, copy],
        ['proj-type-offline', 'proj-type-remote']
      )
    ).toBe(source);
  });

  it('returns the media itself when it is the general resource (includeSelf)', () => {
    const general = media('general', { typeId: 'proj-type' });

    expect(generalResourceMedia(general, [general], ['proj-type'])).toBe(
      general
    );
    // Delete never acts on the general resource itself, so it opts out.
    expect(
      generalResourceMedia(general, [general], ['proj-type'], {
        includeSelf: false,
      })
    ).toBe(undefined);
  });

  it('ignores copies of a non-general source', () => {
    const source = media('source', { typeId: 'other-type' });
    const copy = media('copy', { sourceId: 'source', typeId: 'resource' });

    expect(generalResourceMedia(copy, [source, copy], ['proj-type'])).toBe(
      undefined
    );
  });

  it('ignores blank type ids so untyped media never matches an id-less type', () => {
    const untyped = media('untyped');

    expect(generalResourceMedia(untyped, [untyped], [undefined, null])).toBe(
      undefined
    );
  });
});
