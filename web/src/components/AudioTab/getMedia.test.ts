import { MediaFile } from '../../model';
import { related } from '../../crud';
import { mediaRow, IGetMedia } from './getMedia';

jest.mock('../../crud', () => ({
  related: jest.fn(),
  mediaFileName: jest.fn(() => 'audio.mp3'),
  PublishLevelEnum: { None: 'None' },
}));

jest.mock('./GetReference', () => ({
  GetReference: () => null,
}));

jest.mock('./getSection', () => ({
  getSection: () => '',
}));

jest.mock('../../crud/passage', () => ({
  passageBook: () => '',
}));

const baseData: IGetMedia = {
  planName: 'Plan',
  passages: [],
  sections: [],
  playItem: '',
  allBookData: [],
  sectionMap: new Map(),
};

const media = (attrs: Partial<MediaFile['attributes']>): MediaFile =>
  ({
    id: 'mf-1',
    type: 'mediafile',
    attributes: {
      dateCreated: '2020-06-15T10:00:00.000Z',
      dateUpdated: '2024-01-20T12:00:00.000Z',
      duration: 0,
      filesize: 0,
      ...attrs,
    },
  }) as MediaFile;

describe('mediaRow date', () => {
  beforeEach(() => {
    (related as jest.Mock).mockImplementation((rec: MediaFile, rel: string) => {
      if (rel === 'passage') return '';
      if (rel === 'plan') return 'plan-1';
      if (rel === 'recordedbyUser') return '';
      return '';
    });
  });

  it('uses mediafile dateCreated, not dateUpdated', () => {
    const row = mediaRow(media({}), baseData);
    expect(row.date).toBe('2020-06-15T10:00:00.000Z');
  });

  it('uses dateCreated when passage has a newer dateUpdated', () => {
    (related as jest.Mock).mockImplementation((rec: MediaFile, rel: string) => {
      if (rel === 'passage') return 'pass-1';
      if (rel === 'plan') return 'plan-1';
      return '';
    });
    const data: IGetMedia = {
      ...baseData,
      passages: [
        {
          id: 'pass-1',
          type: 'passage',
          attributes: {
            dateUpdated: '2025-05-01T00:00:00.000Z',
            reference: '1',
            sequencenum: 1,
          },
        } as never,
      ],
    };
    const row = mediaRow(media({}), data);
    expect(row.date).toBe('2020-06-15T10:00:00.000Z');
  });
});
