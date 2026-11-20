import { MediaFile } from '../../../model';
import { resourceClip } from './resourceClip';

const media = (segments?: string) =>
  ({ attributes: { segments } }) as MediaFile;
const projRes = (regions: unknown) =>
  JSON.stringify([
    { name: 'ProjRes', regionInfo: JSON.stringify(regions) },
    { name: 'Transcription', regionInfo: '{}' },
  ]);

describe('resourceClip', () => {
  it('is the first ProjectResource segment', () => {
    expect(
      resourceClip(
        media(
          projRes([
            { start: 3, end: 8 },
            { start: 20, end: 30 },
          ])
        )
      )
    ).toEqual({ start: 3, end: 8 });
  });

  it.each([
    ['no media', undefined],
    ['no segments', media(undefined)],
    ['no ProjectResource segment', media('[{"name":"BT","regionInfo":"[]"}]')],
    ['an empty one', media(projRes([]))],
    ['unreadable segments', media('not json')],
  ])('is the whole media for %s', (_case, m) => {
    expect(resourceClip(m)).toBeUndefined();
  });
});
