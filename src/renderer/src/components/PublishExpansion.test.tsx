// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Bible, ICardsStrings, Organization, ProjectD } from '../model';

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
  bibleidformat: 'Bible Id must start with a 3-letter language code',
  bibleidiso: 'Bible Id must match the language',
  bibleidexists: 'This Bible Id already exists',
  bibleOwnerRights: "Team '{0}' is the owner of this Bible.",
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

describe('PublishExpansion bibleId ownership validation (TT-7681)', () => {
  beforeEach(() => {
    mockGetBibleMediaPlan.mockReset();
    mockGetBibleMediaPlan.mockResolvedValue({ id: 'plan-1' });
  });

  // Another team already owns this Bible Id. TeamDialog loads that team's
  // bible record into `bible` and flags `ownerName` once the id resolves,
  // which is why this prop shape (not our own team's bible) matters here.
  const foreignBible = {
    id: 'bible-other-team',
    type: 'bible',
    attributes: { bibleId: 'SEHICE', bibleName: '', description: '' },
  } as Bible;

  const renderWithForeignBible = (
    setValue: jest.Mock,
    overrides: { foreignOwner?: boolean; ownerName?: string } = {}
  ) =>
    render(
      <PublishExpansion
        t={t}
        team={team}
        bible={foreignBible}
        foreignOwner={overrides.foreignOwner ?? true}
        ownerName={
          'ownerName' in overrides
            ? overrides.ownerName
            : '01 Test Team Desktop 03 Sep 2026'
        }
        readonly
        setValue={setValue}
        onChanged={jest.fn()}
        onRecording={jest.fn()}
        bibles={[foreignBible]}
      />
    );

  const lastBibleIdError = (setValue: jest.Mock): string | undefined =>
    setValue.mock.calls
      .filter(([what]) => what === 'bibleIdError')
      .map(([, value]) => value)
      .pop();

  const deleteAndRetypeLastChar = async () => {
    await waitFor(() => expect(capturedCanRecord).toBeDefined());

    const input = document.getElementById('bibleid') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('SEHICE');

    // Delete the last character, then retype it to restore the original,
    // still-foreign, Bible Id -- mirrors the steps in TT-7681.
    fireEvent.change(input, { target: { value: 'SEHIC' } });
    fireEvent.change(input, { target: { value: 'SEHICE' } });

    return input;
  };

  it('keeps the existing-bible error after deleting and retyping the last character', async () => {
    const setValue = jest.fn();
    renderWithForeignBible(setValue);
    const input = await deleteAndRetypeLastChar();

    expect(lastBibleIdError(setValue)).toBe(t.bibleidexists);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  // Devin finding: `ownerName` is only a display-name lookup and can be
  // undefined even when the bible is genuinely foreign-owned, e.g. the
  // owning team's `organization` record hasn't loaded locally (only its
  // Bible and organizationbible records are cached). Validation must not
  // treat a missing name as proof of ownership.
  it('keeps the existing-bible error when the foreign owner name has not loaded', async () => {
    const setValue = jest.fn();
    renderWithForeignBible(setValue, {
      foreignOwner: true,
      ownerName: undefined,
    });
    const input = await deleteAndRetypeLastChar();

    expect(lastBibleIdError(setValue)).toBe(t.bibleidexists);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
