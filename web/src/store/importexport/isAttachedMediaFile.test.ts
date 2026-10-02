import { MediaFileD } from '../../model';
import { isAttachedMediaFile } from './isAttachedMediaFile';

const rel = (type: string, id: string) => ({ data: { type, id } });

const mf = (
  attrs: Record<string, unknown>,
  relationships: Record<string, unknown> = {}
): MediaFileD =>
  ({
    type: 'mediafile',
    id: 'm1',
    attributes: attrs,
    relationships,
  }) as unknown as MediaFileD;

describe('isAttachedMediaFile', () => {
  it('includes vernacular audio on a passage', () => {
    expect(
      isAttachedMediaFile(
        mf(
          { contentType: 'audio/mpeg', resourcePassageId: -1 },
          { passage: rel('passage', 'pas-1') }
        )
      )
    ).toBe(true);
  });

  it('includes artifact audio with no passage', () => {
    expect(
      isAttachedMediaFile(
        mf(
          { contentType: 'audio/mpeg' },
          { artifactType: rel('artifacttype', 'at-1') }
        )
      )
    ).toBe(true);
  });

  it('excludes resource-passage media (ResourcePassageId set)', () => {
    expect(
      isAttachedMediaFile(
        mf(
          { contentType: 'audio/mpeg', resourcePassageId: 42 },
          {
            passage: rel('passage', 'pas-b'),
            artifactType: rel('artifacttype', 'shared'),
          }
        )
      )
    ).toBe(false);
  });

  it('excludes resource-passage media (resourcePassage relationship)', () => {
    expect(
      isAttachedMediaFile(
        mf(
          { contentType: 'audio/mpeg', resourcePassageId: -1 },
          {
            passage: rel('passage', 'pas-b'),
            resourcePassage: rel('passage', 'pas-a1'),
          }
        )
      )
    ).toBe(false);
  });

  it('excludes text/markdown', () => {
    expect(
      isAttachedMediaFile(
        mf(
          { contentType: 'text/markdown', resourcePassageId: -1 },
          { passage: rel('passage', 'pas-1') }
        )
      )
    ).toBe(false);
  });

  it('includes speaker-rights audio (intellectualproperty artifact type)', () => {
    expect(
      isAttachedMediaFile(
        mf(
          { contentType: 'audio/mpeg' },
          { artifactType: rel('artifacttype', 'intellectualproperty') }
        )
      )
    ).toBe(true);
  });

  it('includes bible and category title audio (title artifact type)', () => {
    expect(
      isAttachedMediaFile(
        mf(
          { contentType: 'audio/mpeg' },
          { artifactType: rel('artifacttype', 'title') }
        )
      )
    ).toBe(true);
  });

  it('excludes media with neither passage nor artifact type', () => {
    expect(
      isAttachedMediaFile(mf({ contentType: 'audio/mpeg', audioUrl: 'ip.mp3' }))
    ).toBe(false);
  });
});
