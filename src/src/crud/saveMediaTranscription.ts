import { RecordTransformBuilder } from '@orbit/records';
import Memory from '@orbit/memory';
import { MediaFileD } from '../model';
import { UpdateRecord } from '../model/baseModel';

export async function saveMediaTranscription(
  memory: Memory,
  mediafile: MediaFileD,
  transcription: string,
  user: string
): Promise<void> {
  const tb = new RecordTransformBuilder();
  const ops = UpdateRecord(
    tb,
    {
      type: 'mediafile',
      id: mediafile.id,
      attributes: {
        ...mediafile.attributes,
        transcription,
      },
    } as MediaFileD,
    user
  );
  await memory.update(ops);
}
