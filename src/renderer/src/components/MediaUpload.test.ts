import { filterFilesBySizeLimit, SIZELIMIT } from './uploadSizeLimits';
import { UploadType } from './UploadType';

jest.mock('../../api-variable', () => ({
  API_CONFIG: { sizeLimit: '30' },
}));

const mb = (n: number) => n * 1000000;

describe('SIZELIMIT', () => {
  it('uses API size limit for section/passage resource uploads', () => {
    expect(SIZELIMIT(UploadType.Resource)).toBe(30);
    expect(SIZELIMIT(UploadType.Media)).toBe(30);
  });

  it('uses 50 MB for general (project) resource uploads', () => {
    expect(SIZELIMIT(UploadType.ProjectResource)).toBe(50);
  });
});

describe('filterFilesBySizeLimit', () => {
  const file = (name: string, sizeBytes: number) =>
    ({ name, size: sizeBytes }) as File;

  it('accepts files at or under the limit', () => {
    const files = [file('a.mp3', mb(30)), file('b.mp3', mb(10))];
    const { accepted, rejected } = filterFilesBySizeLimit(files, 30);
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it('rejects files over the limit', () => {
    const files = [file('big.mp3', mb(31))];
    const { accepted, rejected } = filterFilesBySizeLimit(files, 30);
    expect(accepted).toHaveLength(0);
    expect(rejected).toEqual(files);
  });

  it('accepts a 31 MB file under the 50 MB general limit', () => {
    const files = [file('general.mp3', mb(31))];
    const { accepted, rejected } = filterFilesBySizeLimit(
      files,
      SIZELIMIT(UploadType.ProjectResource)
    );
    expect(accepted).toEqual(files);
    expect(rejected).toHaveLength(0);
  });

  it('rejects a 31 MB file under the 30 MB section limit', () => {
    const files = [file('section.mp3', mb(31))];
    const { accepted, rejected } = filterFilesBySizeLimit(
      files,
      SIZELIMIT(UploadType.Resource)
    );
    expect(accepted).toHaveLength(0);
    expect(rejected).toEqual(files);
  });
});
