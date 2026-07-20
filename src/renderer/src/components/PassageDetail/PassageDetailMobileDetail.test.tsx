// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

const discussionSize = { width: 450, height: 900 };

jest.mock('../../context/usePassageDetailContext', () => () => ({
  currentstep: 'step-1',
  section: { id: 's1', type: 'section' },
  discussionSize,
  promptDockedRecordButton: null,
  promptDockedRecordFooterVersion: 0,
}));

jest.mock('../../crud', () => {
  const { ToolSlug: Slug } = jest.requireActual<
    typeof import('../../crud/toolSlug')
  >('../../crud/toolSlug');
  return {
    ToolSlug: Slug,
    useStepTool: () => ({ tool: Slug.Record, settings: {} }),
  };
});

jest.mock('../../crud/useRole', () => ({
  useRole: () => ({ userIsAdmin: false }),
}));

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoSectionStep: () => false,
    permissionsOn: false,
  }),
}));

jest.mock('./PassageDetailMobileLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-cy="mobile-layout">{children}</div>
  ),
}));

jest.mock('./mobile/MobileWorkflowSteps', () => () => null);
jest.mock('./mobile/PassageDetailMobileFooter', () => () => null);

jest.mock('../Discussions/DiscussionPanel', () => ({
  __esModule: true,
  default: () => <div data-cy="discussion-panel">Discussion</div>,
}));

import PassageDetailMobileDetail from './PassageDetailMobileDetail';

describe('PassageDetailMobileDetail (TT-7373)', () => {
  it('uses a fixed discussion column width when side-by-side', () => {
    const { container } = render(
      <PassageDetailMobileDetail
        showNoAudioPlaceholder={false}
        showSideBySide={true}
        recordContent={<div data-cy="record-content">Waveform</div>}
        noAudioText="No audio"
      />
    );

    expect(
      container.querySelector('[data-cy="discussion-side-by-side"]')
    ).toBeTruthy();
    const column = container.querySelector(
      '[data-cy="discussion-side-column"]'
    ) as HTMLElement;
    expect(column).toBeTruthy();
    expect(column).toHaveStyle({ width: '450px' });
    expect(
      container.querySelector('[data-cy="record-content"]')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-cy="discussion-panel"]')
    ).toBeTruthy();
  });

  it('stacks discussion below content when not side-by-side', () => {
    const { container } = render(
      <PassageDetailMobileDetail
        showNoAudioPlaceholder={false}
        showSideBySide={false}
        recordContent={<div data-cy="record-content">Waveform</div>}
        noAudioText="No audio"
      />
    );

    expect(
      container.querySelector('[data-cy="discussion-side-by-side"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="record-content"]')
    ).toBeTruthy();
    expect(
      container.querySelector('[data-cy="discussion-panel"]')
    ).toBeTruthy();
  });
});
