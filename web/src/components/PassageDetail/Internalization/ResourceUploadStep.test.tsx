import { act, cleanup, render } from '@testing-library/react';
import { UploadType } from '../../UploadType';

type PanelProps = {
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  beforeUpload?: () => Promise<void>;
};

let capturedPanel: PanelProps | undefined;

jest.mock('../../PassageRecordPanel', () => ({
  __esModule: true,
  default: (props: PanelProps) => {
    capturedPanel = props;
    return <div data-testid="passage-record-panel" />;
  },
}));

jest.mock('../../MediaUploadContent', () => ({
  __esModule: true,
  default: () => null,
}));

// The upload pipeline is exercised in useMediaUpload's own tests; here we only
// verify how ResourceUploadStep wires beforeUpload / afterUploadCb to the panel.
jest.mock('../../../crud', () => ({
  useMediaUpload: () => jest.fn(),
  VernacularTag: null,
}));

jest.mock('../../../utils', () => ({
  restoreScroll: jest.fn(),
}));

jest.mock('../../../utils/contentType', () => ({
  splitFaithbridgeValue: jest.fn(),
}));

import ResourceUploadStep from './ResourceUploadStep';

function renderStep(beforeUpload: () => Promise<void>) {
  const cancelled = { current: false };
  return render(
    <ResourceUploadStep
      active
      isAudioMode
      uploadType={UploadType.Media}
      cancelled={cancelled}
      finish={jest.fn()}
      beforeUpload={beforeUpload}
      defaultFilename="resource"
    />
  );
}

describe('ResourceUploadStep recorded path beforeUpload', () => {
  beforeEach(() => {
    capturedPanel = undefined;
  });
  afterEach(cleanup);

  /**
   * Recorded save goes MediaRecord → useMediaUpload (await beforeUpload, then
   * stage) → ResourceUploadStep.afterUploadCb on success. The after-upload hook
   * must not commit again — SelectArtifactCategory.commit() is not idempotent if
   * React has not re-rendered the new category yet (TT-7363 Copilot r3919030521).
   */
  it('forwards beforeUpload and does not re-commit it in afterUploadCb', async () => {
    const created: string[] = [];
    const beforeUpload = jest.fn(async () => {
      created.push(`cat-${created.length + 1}`);
    });
    renderStep(beforeUpload);
    expect(capturedPanel?.beforeUpload).toBe(beforeUpload);

    await act(async () => {
      await capturedPanel!.beforeUpload!();
      await capturedPanel!.afterUploadCb('media-1');
    });

    expect(created).toEqual(['cat-1']);
  });
});

// TODO look through tests
