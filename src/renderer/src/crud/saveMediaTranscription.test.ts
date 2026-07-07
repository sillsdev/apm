import { RecordTransformBuilder } from '@orbit/records';
import { MediaFileD } from '../model';
import { saveMediaTranscription } from './saveMediaTranscription';

jest.mock('../model/baseModel', () => ({
  UpdateRecord: jest.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_t: RecordTransformBuilder, rec: MediaFileD, _user: string) => [
      {
        op: 'updateRecord',
        record: rec,
      },
    ]
  ),
}));

describe('saveMediaTranscription', () => {
  it('updates transcription on the mediafile', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const memory = { update } as unknown as import('@orbit/memory').default;
    const mediafile = {
      id: 'mf1',
      type: 'mediafile',
      attributes: {
        transcription: 'old',
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
    } as MediaFileD;

    await saveMediaTranscription(memory, mediafile, 'new text', 'user1');

    expect(update).toHaveBeenCalledTimes(1);
    const ops = update.mock.calls[0][0];
    expect(ops[0].record.attributes.transcription).toBe('new text');
  });
});
