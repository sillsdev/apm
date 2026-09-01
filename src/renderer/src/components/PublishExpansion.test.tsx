// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ICardsStrings, Organization, ProjectD } from '../model';

const mockShowMessage = jest.fn();
const mockGetBibleMediaPlan = jest.fn();
let mockProjects: ProjectD[] = [];
let capturedCanRecord: (() => Promise<boolean>) | undefined;

jest.mock('../control/MediaTitle', () => ({
  __esModule: true,
  default: (props: { canRecord?: () => Promise<boolean> }) => {
    capturedCanRecord = props.canRecord;
    return <div data-testid="media-title" />;
  },
}));

jest.mock('../control', () => ({
  LightTooltip: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: mockShowMessage }),
}));

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: () => mockProjects,
}));

jest.mock('../crud/useBibleMedia', () => ({
  useBibleMedia: () => ({ getBibleMediaPlan: mockGetBibleMediaPlan }),
}));

jest.mock('../utils', () => ({
  isLangSet: (code?: string) => Boolean(code),
}));

jest.mock('../crud', () => ({
  related: (
    rec: { relationships?: Record<string, { data?: { id?: string } }> },
    key: string
  ) => rec?.relationships?.[key]?.data?.id,
  useOrgDefaults: () => ({ getDefault: () => undefined }),
  useBible: () => ({ getPublishingData: () => undefined }),
  orgDefaultLangProps: 'langProps',
  pubDataCopyright: 'copyright',
  pubDataLangProps: 'langProps',
}));

import PublishExpansion from './PublishExpansion';

const t = {
  publishing: 'Publishing',
  bibleid: 'Bible Id',
  bibleIdExplain: 'Explain',
  language: 'Language: {0}',
  biblename: 'Bible Name',
  description: 'Description',
  copyright: 'Copyright',
  projectRequired: 'A project must be added before recordings are allowed',
  planNotFound: 'Plan not found. Please contact APM Support.',
} as ICardsStrings;

const team = { id: 'team-1' } as Organization;

const teamProject = {
  id: 'proj-1',
  type: 'project',
  relationships: {
    organization: { data: { type: 'organization', id: 'team-1' } },
  },
} as ProjectD;

describe('PublishExpansion BibleMedia plan', () => {
  beforeEach(() => {
    mockShowMessage.mockReset();
    mockGetBibleMediaPlan.mockReset();
    mockProjects = [];
    capturedCanRecord = undefined;
  });

  const renderPublish = () =>
    render(
      <PublishExpansion
        t={t}
        team={team}
        setValue={jest.fn()}
        onChanged={jest.fn()}
        onRecording={jest.fn()}
        bibles={[]}
      />
    );

  it('shows a support snackbar when the BibleMedia plan is missing', async () => {
    mockGetBibleMediaPlan.mockResolvedValue(undefined);
    renderPublish();
    await waitFor(() => expect(capturedCanRecord).toBeDefined());

    let allowed = true;
    await act(async () => {
      allowed = await capturedCanRecord!();
    });

    expect(allowed).toBe(false);
    expect(mockShowMessage).toHaveBeenCalledWith(t.planNotFound);
  });

  it('does not show the plan snackbar when a BibleMedia plan exists', async () => {
    mockGetBibleMediaPlan.mockResolvedValue({ id: 'plan-1' });
    mockProjects = [teamProject];
    renderPublish();
    await waitFor(() => expect(capturedCanRecord).toBeDefined());

    let allowed = false;
    await act(async () => {
      allowed = await capturedCanRecord!();
    });

    expect(allowed).toBe(true);
    expect(mockShowMessage).not.toHaveBeenCalledWith(t.planNotFound);
  });
});
