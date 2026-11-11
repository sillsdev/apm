import { act, cleanup, render } from '@testing-library/react';
import { UploadType } from '../../UploadType';
import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';

type PanelProps = {
  artifactTypeSlug?: string | null;
  finish: (mediaRemoteIds?: string[]) => Promise<void>;
  uploadMethod?: unknown;
};
type ContentProps = {
  inValue?: string;
  uploadMethod?: unknown;
};

let capturedPanel: PanelProps | undefined;
let capturedContent: ContentProps | undefined;

jest.mock('../../PassageRecordPanel', () => ({
  __esModule: true,
  default: (props: PanelProps) => {
    capturedPanel = props;
    return <div data-testid="passage-record-panel" />;
  },
}));

jest.mock('../../MediaUploadContent', () => ({
  __esModule: true,
  default: (props: ContentProps) => {
    capturedContent = props;
    return <div data-testid="media-upload-content" />;
  },
}));

// The upload pipeline is covered by useMediaUpload's own tests; here we only
// check the config ResourceUploadStep hands it and where its result goes.
const mockUploadMethod = jest.fn();
const mockUseMediaUpload = jest.fn((_opts: unknown) => mockUploadMethod);
jest.mock('../../../crud', () => ({
  useMediaUpload: (opts: unknown) => mockUseMediaUpload(opts),
}));

jest.mock('../../../utils', () => ({
  restoreScroll: jest.fn(),
}));

const mockSplitFaithbridgeValue = jest.fn((value: string) => {
  const [url, transcription] = value.split('||');
  return { url, transcription };
});
jest.mock('../../../utils/contentType', () => ({
  splitFaithbridgeValue: (value: string) => mockSplitFaithbridgeValue(value),
}));

import ResourceUploadStep from './ResourceUploadStep';

type StepProps = React.ComponentProps<typeof ResourceUploadStep>;

function renderStep(overrides: Partial<StepProps> = {}) {
  const props: StepProps = {
    active: true,
    isAudioMode: true,
    uploadType: UploadType.Media,
    cancelled: { current: false },
    finish: jest.fn(),
    defaultFilename: 'resource',
    ...overrides,
  };
  render(<ResourceUploadStep {...props} />);
  return props;
}

function hookOptions() {
  return mockUseMediaUpload.mock.calls.at(-1)?.[0] as {
    fields: Record<string, unknown>;
    [key: string]: unknown;
  };
}

describe('ResourceUploadStep', () => {
  beforeEach(() => {
    capturedPanel = undefined;
    capturedContent = undefined;
    jest.clearAllMocks();
  });
  afterEach(cleanup);

  describe('record finish', () => {
    it('clears cancelled and forwards ids when the recording uploaded', async () => {
      const cancelled = { current: true };
      const { finish } = renderStep({ cancelled });

      await act(async () => {
        await capturedPanel!.finish(['media-1']);
      });

      expect(cancelled.current).toBe(false);
      expect(finish).toHaveBeenCalledWith(['media-1']);
    });

    it.each([
      ['no ids', undefined],
      ['empty ids', [] as string[]],
    ])('marks cancelled and still calls finish with %s', async (_, ids) => {
      const cancelled = { current: false };
      const { finish } = renderStep({ cancelled });

      await act(async () => {
        await capturedPanel!.finish(ids);
      });

      expect(cancelled.current).toBe(true);
      expect(finish).toHaveBeenCalledWith(ids);
    });

    it('resolves without a finish prop', async () => {
      const cancelled = { current: false };
      renderStep({ cancelled, finish: undefined });

      await act(async () => {
        await expect(
          capturedPanel!.finish(['media-1'])
        ).resolves.toBeUndefined();
      });
      expect(cancelled.current).toBe(false);
    });
  });

  describe('mode', () => {
    it('renders the record panel in audio mode, wired to the upload hook', () => {
      renderStep({ isAudioMode: true });

      expect(capturedPanel?.uploadMethod).toBe(mockUploadMethod);
      expect(capturedContent).toBeUndefined();
    });

    it('renders the upload content otherwise, wired to the upload hook', () => {
      renderStep({ isAudioMode: false });

      expect(capturedContent?.uploadMethod).toBe(mockUploadMethod);
      expect(capturedPanel).toBeUndefined();
    });
  });

  describe('Faithbridge link value', () => {
    it('shows only the url and sends the transcription to the upload', () => {
      renderStep({
        isAudioMode: false,
        uploadType: UploadType.FaithbridgeLink,
        inValue: 'https://fb.example/x||hello world',
      });

      expect(capturedContent?.inValue).toBe('https://fb.example/x');
      expect(hookOptions().fields.transcription).toBe('hello world');
    });

    it('passes inValue through untouched for other upload types', () => {
      renderStep({
        isAudioMode: false,
        uploadType: UploadType.Link,
        inValue: 'https://example.com/a||b',
      });

      expect(mockSplitFaithbridgeValue).not.toHaveBeenCalled();
      expect(capturedContent?.inValue).toBe('https://example.com/a||b');
      expect(hookOptions().fields.transcription).toBeUndefined();
    });
  });

  describe('artifactTypeSlug', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('defaults to null (Vernacular) when %s', (_, artifactTypeSlug) => {
      renderStep({ artifactTypeSlug });

      expect(hookOptions().fields.artifactTypeSlug).toBeNull();
      expect(capturedPanel?.artifactTypeSlug).toBeNull();
    });

    it('uses the given artifactTypeSlug', () => {
      renderStep({ artifactTypeSlug: ArtifactTypeSlug.Resource });

      expect(hookOptions().fields.artifactTypeSlug).toBe('resource');
      expect(capturedPanel?.artifactTypeSlug).toBe('resource');
    });
  });

  it('configures the upload hook from its props', () => {
    const beforeUpload = jest.fn(async () => {});
    const pendingRestore = {} as StepProps['pendingRestore'];
    const props = renderStep({
      speaker: 'Ann',
      eafUrl: 'eaf-url',
      uploadType: UploadType.Media,
      beforeUpload,
      pendingRestore,
    });

    expect(hookOptions()).toEqual(
      expect.objectContaining({
        fields: expect.objectContaining({
          performedBy: 'Ann',
          eafUrl: 'eaf-url',
        }),
        uploadType: UploadType.Media,
        finish: props.finish,
        cancelled: props.cancelled,
        beforeUpload,
        pendingRestore,
        versionFilenames: true,
      })
    );
  });
});
