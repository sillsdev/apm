import { act, cleanup, render } from '@testing-library/react';
import { UploadType } from '../../UploadType';
import {
  ResourceUploadContext,
  type IResourceUploadContext,
} from './ResourceUploadContext';

type PanelProps = {
  finish: (mediaRemoteIds?: string[]) => Promise<void>;
  uploadMethod?: unknown;
};
type ContentProps = {
  inValue?: string;
  uploadMethod?: unknown;
};

let capturedPanel: PanelProps | undefined;
let capturedContent: ContentProps | undefined;

jest.mock('./ResourceRecordPanel', () => ({
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

function renderStep(overrides: Partial<IResourceUploadContext> = {}) {
  const value: IResourceUploadContext = {
    active: true,
    isAddingAudioResource: true,
    uploadType: UploadType.Media,
    artifactId: 'art-1',
    cancelled: { current: false },
    finish: jest.fn(),
    defaultFilename: 'resource',
    ...overrides,
  };
  render(
    <ResourceUploadContext.Provider value={value}>
      <ResourceUploadStep />
    </ResourceUploadContext.Provider>
  );
  return value;
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
      renderStep({ isAddingAudioResource: true });

      expect(capturedPanel?.uploadMethod).toBe(mockUploadMethod);
      expect(capturedContent).toBeUndefined();
    });

    it('renders the upload content otherwise, wired to the upload hook', () => {
      renderStep({ isAddingAudioResource: false });

      expect(capturedContent?.uploadMethod).toBe(mockUploadMethod);
      expect(capturedPanel).toBeUndefined();
    });
  });

  describe('Faithbridge link value', () => {
    it('shows only the url and sends the transcription to the upload', () => {
      renderStep({
        isAddingAudioResource: false,
        uploadType: UploadType.FaithbridgeLink,
        inValue: 'https://fb.example/x||hello world',
      });

      expect(capturedContent?.inValue).toBe('https://fb.example/x');
      expect(hookOptions().fields.transcription).toBe('hello world');
    });

    it('passes inValue through untouched for other upload types', () => {
      renderStep({
        isAddingAudioResource: false,
        uploadType: UploadType.Link,
        inValue: 'https://example.com/a||b',
      });

      expect(mockSplitFaithbridgeValue).not.toHaveBeenCalled();
      expect(capturedContent?.inValue).toBe('https://example.com/a||b');
      expect(hookOptions().fields.transcription).toBeUndefined();
    });
  });

  it('uploads with the context artifactId', () => {
    renderStep({ artifactId: 'art-2' });

    expect(hookOptions().fields.artifactId).toBe('art-2');
  });

  it('throws when rendered outside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ResourceUploadStep />)).toThrow(
      /ResourceUploadContext provider/
    );
    spy.mockRestore();
  });

  it('configures the upload hook from its props', () => {
    const beforeUpload = jest.fn(async () => {});
    const pendingRestore = {} as IResourceUploadContext['pendingRestore'];
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
