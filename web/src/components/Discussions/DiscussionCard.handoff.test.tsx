/**
 * TT-7888: a permission-only change must not reassign a discussion.
 *
 * Maya has an open discussion assigned to her. She wrote its only comment
 * before she was in any peer group. An admin then makes her peer group CIT
 * while the card stays mounted. Her comment is still the latest visible one,
 * but she has not posted or edited anything, so the saved assignment must
 * stay with her. The automatic handoff to the Mentor group belongs to a
 * successful comment save, not to a permission refresh.
 */
jest.mock('./DiscussionList', () => ({
  NewDiscussionToolId: 'newDiscussion',
  NewCommentToolId: 'newDiscussioncomment',
}));

jest.mock('../../context/PassageDetailContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    PassageDetailContext: R.createContext({
      state: {},
      setState: jest.fn(),
    }),
  };
});

jest.mock('../../context/UnsavedContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: R.createContext({
      state: {},
      setState: jest.fn(),
    }),
  };
});

jest.mock('./CommentEditor', () => {
  const MockCommentEditor = () => <div data-testid="comment-editor" />;
  MockCommentEditor.displayName = 'MockCommentEditor';
  return { CommentEditor: MockCommentEditor };
});

jest.mock('../../utils', () => ({
  waitForIt: () => Promise.resolve(),
  useWaitForRemoteQueue: () => () => Promise.resolve(),
  removeExtension: (name: string) => ({ name, ext: '' }),
  startEnd: () => undefined,
}));

// Stable references so effects keyed on Orbit data do not churn every render.
const mockOrbit: Record<string, unknown[]> = {};
jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: (model: string) => mockOrbit[model] ?? [],
}));

// Mutable peer state: the test flips Maya from no group to the CIT group.
const mockPeer: {
  permissions: string;
  myGroups: unknown[];
  mentorGroup: unknown;
} = { permissions: '', myGroups: [], mentorGroup: undefined };

jest.mock('../../crud', () => ({
  related: jest.fn(
    (
      rec: {
        relationships?: Record<string, { data?: { id?: string } }>;
      } | null,
      rel: string
    ) => rec?.relationships?.[rel]?.data?.id
  ),
  isPersonalTeam: () => false,
  PermissionName: { CIT: 'consultantInTraining', Mentor: 'mentor' },
  usePermissions: () => ({
    permissions: mockPeer.permissions,
    canAccess: () => true,
    approvalStatus: () => undefined,
    getMentorAuthor: () => undefined,
    hasPermission: (p: string) => mockPeer.permissions.includes(p),
  }),
  useRole: () => ({ userIsAdmin: false }),
  findRecord: jest.fn(),
  useArtifactType: () => ({ commentId: 'comment-artifact' }),
}));

jest.mock('../Peers/usePeerGroups', () => ({
  usePeerGroups: () => ({
    groups: [],
    myGroups: mockPeer.myGroups,
    citGroup: undefined,
    mentorGroup: mockPeer.mentorGroup,
  }),
}));

jest.mock('../../crud/computeCommentVisible', () => ({
  computeCommentVisibleString: () => '{}',
}));

jest.mock('../../crud/remoteId', () => ({
  remoteId: () => 'maya',
}));

jest.mock('../../crud/useArtifactCategory', () => ({
  ArtifactCategoryType: { Discussion: 'discussion' },
  useArtifactCategory: () => ({
    localizedArtifactCategory: (n: string) => n,
  }),
}));

jest.mock('../../crud/useOrgWorkflowSteps', () => ({
  useOrgWorkflowSteps: () => ({
    localizedWorkStepFromId: () => '',
  }),
}));

jest.mock('./useRecordComment', () => ({
  useRecordComment: () => ({
    passageId: 'passage-1',
    fileName: () => 'topic-xxxx--1',
  }),
}));

const mockSaveComment = jest.fn().mockResolvedValue(undefined);
jest.mock('../../crud/useSaveComment', () => ({
  useSaveComment: () => mockSaveComment,
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: (sel: (s: unknown) => unknown) => sel({}),
  shallowEqual: () => true,
}));

jest.mock('../../selector', () => ({
  discussionCardSelector: () => ({
    topic: 'Topic',
    addComment: 'Add',
    assign: 'Assign',
    comments: 'Comments: {0}',
  }),
  sharedSelector: () => ({
    save: 'Save',
    cancel: 'Cancel',
    NoSaveWoMedia: 'No media to save',
  }),
}));

jest.mock('../../control', () => ({
  Button: (props: { id?: string; children?: React.ReactNode }) => (
    <button id={props.id} type="button">
      {props.children}
    </button>
  ),
  LightTooltip: (props: { children?: React.ReactNode }) => (
    <>{props.children}</>
  ),
  StageReport: () => null,
}));

jest.mock('../../control/GroupOrUserAssignment', () => () => null);
jest.mock('../../components/Sheet/SelectArtifactCategory', () => () => null);
jest.mock('../../components/Sheet/ArtCatScr', () => ({
  ArtCatScr: { hide: 'hide' },
}));
jest.mock('../AlertDialog', () => () => null);
jest.mock('../../hoc/BigDialog', () => () => null);
jest.mock('./CommentCard', () => () => null);
// Captures the reply-saved callback so a test can stand in for a saved reply.
let mockOnReplySaved: (() => void | Promise<void>) | undefined;
jest.mock('./ReplyCard', () => {
  const MockReplyCard = (props: {
    onCommentSaved?: () => void | Promise<void>;
  }) => {
    mockOnReplySaved = props.onCommentSaved;
    return null;
  };
  MockReplyCard.displayName = 'MockReplyCard';
  return { __esModule: true, default: MockReplyCard };
});
jest.mock('./DiscussionMenu', () => () => null);
jest.mock('./DiscussionMove', () => () => null);
jest.mock('../UserAvatar', () => () => null);
jest.mock('../GroupAvatar', () => () => null);
jest.mock('../../control/OldVernVersion', () => ({
  OldVernVersion: () => null,
}));

import React from 'react';
import { act, render } from '@testing-library/react';
import MemorySource from '@orbit/memory';
import { RecordSchema } from '@orbit/records';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useGlobal } from '../../context/useGlobal';
import { DiscussionCard } from './DiscussionCard';
import { DiscussionD } from '../../model';

const theme = createTheme();

const hasOne = (type: string) => ({ kind: 'hasOne' as const, type });

const schema = new RecordSchema({
  models: {
    user: { attributes: {}, relationships: {} },
    group: { attributes: {}, relationships: {} },
    mediafile: { attributes: {}, relationships: {} },
    orgworkflowstep: { attributes: {}, relationships: {} },
    artifactcategory: { attributes: {}, relationships: {} },
    discussion: {
      attributes: {
        subject: { type: 'string' },
        resolved: { type: 'boolean' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        mediafile: hasOne('mediafile'),
        orgWorkflowStep: hasOne('orgworkflowstep'),
        artifactCategory: hasOne('artifactcategory'),
        group: hasOne('group'),
        user: hasOne('user'),
        creatorUser: hasOne('user'),
        lastModifiedByUser: hasOne('user'),
      },
    },
  },
});

const unsavedState = {
  toolChanged: jest.fn(),
  toolsChanged: {},
  saveCompleted: jest.fn(),
  saveRequested: () => false,
  clearRequested: () => false,
  clearCompleted: jest.fn(),
  startSave: jest.fn(),
  startClear: jest.fn(),
  isChanged: () => false,
};

const passageState = {
  currentstep: 'step-1',
  playerMediafile: { id: 'vern-1', attributes: {} },
  setPlayerSegments: jest.fn(),
  currentSegment: '',
  handleHighlightDiscussion: jest.fn(),
  highlightDiscussion: undefined,
  refresh: 0,
};

describe('DiscussionCard automatic handoff (TT-7888)', () => {
  const maya = 'maya';
  const mentorGroup = {
    type: 'group',
    id: 'mentor-group',
    attributes: { name: 'Mentors' },
  };
  const citGroup = {
    type: 'group',
    id: 'cit-group',
    attributes: { name: 'CITs' },
  };
  let memory: MemorySource;

  beforeEach(async () => {
    mockSaveComment.mockClear();
    mockPeer.permissions = '';
    mockPeer.myGroups = [];
    mockPeer.mentorGroup = mentorGroup;

    memory = new MemorySource({ schema });
    await memory.update((t) => [
      t.addRecord({ type: 'user', id: maya, attributes: {} }),
      t.addRecord({ type: 'mediafile', id: 'vern-1', attributes: {} }),
      t.addRecord({
        type: 'discussion',
        id: 'disc-1',
        attributes: { subject: 'Verse 1', resolved: false },
        relationships: {
          mediafile: { data: { type: 'mediafile', id: 'vern-1' } },
          user: { data: { type: 'user', id: maya } },
          creatorUser: { data: { type: 'user', id: maya } },
        },
      }),
    ]);

    mockOrbit.user = [{ type: 'user', id: maya, attributes: {} }];
    mockOrbit.group = [mentorGroup, citGroup];
    mockOrbit.mediafile = [
      { type: 'mediafile', id: 'vern-1', attributes: { versionNumber: 1 } },
    ];
    // Maya's only comment, written before she was in any peer group.
    mockOrbit.comment = [
      {
        type: 'comment',
        id: 'comment-1',
        attributes: {
          commentText: 'Please check verse 1',
          visible: '',
          dateCreated: '2026-11-01T10:00:00Z',
          dateUpdated: '2026-11-01T10:00:00Z',
        },
        relationships: {
          discussion: { data: { type: 'discussion', id: 'disc-1' } },
          creatorUser: { data: { type: 'user', id: maya } },
          lastModifiedByUser: { data: { type: 'user', id: maya } },
        },
      },
    ];

    (useGlobal as jest.Mock).mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        user: maya,
        memory,
        organization: 'org-1',
        offline: false,
        offlineOnly: false,
      };
      return [values[key], jest.fn()];
    });
  });

  const savedDiscussion = () =>
    memory.cache.query((q) =>
      q.findRecord({ type: 'discussion', id: 'disc-1' })
    ) as DiscussionD;

  const card = () => (
    <ThemeProvider theme={theme}>
      <PassageDetailContext.Provider
        value={{ state: passageState as never, setState: jest.fn() }}
      >
        <UnsavedContext.Provider
          value={{ state: unsavedState as never, setState: jest.fn() }}
        >
          <DiscussionCard
            id="card-0"
            discussion={savedDiscussion()}
            collapsed={false}
            showStep={false}
            showReference={false}
            requestHighlight=""
            refreshList={jest.fn()}
          />
        </UnsavedContext.Provider>
      </PassageDetailContext.Provider>
    </ThemeProvider>
  );

  // Let the effect chain (comment list -> handoff -> assignment save) and the
  // async Orbit write settle before asserting nothing was saved.
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

  it('keeps the saved assignment when only peer group permissions change', async () => {
    const { rerender } = render(card());
    await settle();
    const update = jest.spyOn(memory, 'update');

    // Admin makes Maya's peer group CIT while the card stays mounted.
    mockPeer.permissions = 'consultantInTraining';
    mockPeer.myGroups = [citGroup];
    rerender(card());
    await settle();

    const saved = savedDiscussion();
    expect(saved.relationships?.group?.data).toBeFalsy();
    expect(
      (saved.relationships?.user?.data as { id: string } | undefined)?.id
    ).toBe(maya);
    expect(update).not.toHaveBeenCalled();
    expect(mockSaveComment).not.toHaveBeenCalled();
  });

  it('hands the discussion to the Mentor group after a CIT reply saves', async () => {
    mockPeer.permissions = 'consultantInTraining';
    mockPeer.myGroups = [citGroup];
    render(card());
    await settle();
    expect(savedDiscussion().relationships?.group?.data).toBeFalsy();

    await act(async () => {
      await mockOnReplySaved?.();
    });

    const saved = savedDiscussion();
    expect(
      (saved.relationships?.group?.data as { id: string } | undefined)?.id
    ).toBe('mentor-group');
    expect(saved.relationships?.user?.data).toBeFalsy();
  });
});
