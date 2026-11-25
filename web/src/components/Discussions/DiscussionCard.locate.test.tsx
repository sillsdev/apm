/**
 * TT-7887 (PR #894 review): when a discussion's waveform region is located,
 * its card scrolls itself so its header is at the top of the list.
 *
 * Locating the same region again only bumps `refresh` in PassageDetailContext.
 * When the card handed its ref to DiscussionList (`setRef(cardRef)`) and the
 * list scrolled in an effect keyed on that ref, the second locate set the same
 * ref, React skipped the update, and a list the user had scrolled away stayed
 * put. The card now scrolls imperatively on every locate.
 *
 * jsdom has no layout, so this asserts the scroll request; the drawer layout
 * is covered by DiscussionListScroll.cy.tsx.
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

jest.mock('./CommentEditor', () => ({ CommentEditor: () => null }));

const mockRegion = { start: 10, end: 12 };
jest.mock('../../utils', () => ({
  waitForIt: () => Promise.resolve(),
  useWaitForRemoteQueue: () => () => Promise.resolve(),
  removeExtension: (name: string) => ({ name, ext: '' }),
  startEnd: (subject?: string) => (subject ? mockRegion : undefined),
}));

const emptyOrbit: unknown[] = [];
const emptyPermissions: unknown[] = [];
const emptyGroups: unknown[] = [];
jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => emptyOrbit,
}));

jest.mock('../../crud', () => ({
  related: jest.fn(
    (
      rec: {
        relationships?: Record<string, { data?: { id?: string } }>;
      } | null,
      rel: string
    ) => rec?.relationships?.[rel]?.data?.id
  ),
  isPersonalTeam: () => true,
  PermissionName: { CIT: 'CIT', Mentor: 'Mentor' },
  usePermissions: () => ({
    permissions: emptyPermissions,
    canAccess: () => true,
    approvalStatus: () => undefined,
    getMentorAuthor: () => undefined,
    hasPermission: () => false,
  }),
  useRole: () => ({ userIsAdmin: true }),
  findRecord: jest.fn(),
  useArtifactType: () => ({ commentId: 'comment-artifact' }),
}));

jest.mock('../../crud/computeCommentVisible', () => ({
  computeCommentVisibleString: () => '{}',
}));

jest.mock('../../crud/remoteId', () => ({
  remoteId: () => 'user-1',
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

jest.mock('../../crud/useGroupOrUser', () => ({
  useGroupOrUser: () => ({
    assignedGroup: null,
    assignedUser: null,
    editAssigned: '',
    setEditAssigned: jest.fn(),
    setAssigned: jest.fn(),
  }),
}));

jest.mock('./useRecordComment', () => ({
  useRecordComment: () => ({
    passageId: 'passage-1',
    fileName: () => 'topic-xxxx--1',
  }),
}));

jest.mock('../../crud/useSaveComment', () => ({
  useSaveComment: () => jest.fn().mockResolvedValue(undefined),
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
jest.mock('./ReplyCard', () => () => null);
jest.mock('./DiscussionMenu', () => () => null);
jest.mock('./DiscussionMove', () => () => null);
jest.mock('../UserAvatar', () => () => null);
jest.mock('../GroupAvatar', () => () => null);
jest.mock('../Peers/usePeerGroups', () => ({
  usePeerGroups: () => ({
    groups: emptyGroups,
    myGroups: emptyGroups,
    citGroup: undefined,
    mentorGroup: undefined,
  }),
}));
jest.mock('../../control/OldVernVersion', () => ({
  OldVernVersion: () => null,
}));

import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useGlobal } from '../../context/useGlobal';
import { DiscussionCard } from './DiscussionCard';
import { DiscussionD } from '../../model';

const theme = createTheme();

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

const discussion = {
  type: 'discussion',
  id: 'disc-1',
  attributes: { subject: 'Topic 10-12', resolved: false },
} as DiscussionD;

const cardTree = (refresh: number) => {
  const passageState = {
    currentstep: 'step-mark',
    playerMediafile: {
      id: 'vern-1',
      attributes: { duration: 47, originalFile: 'vern.wav' },
    },
    setPlayerSegments: jest.fn(),
    currentSegment: '',
    handleHighlightDiscussion: jest.fn(),
    highlightDiscussion: mockRegion.start,
    refresh,
  };
  return (
    <ThemeProvider theme={theme}>
      <PassageDetailContext.Provider
        value={{ state: passageState as never, setState: jest.fn() }}
      >
        <UnsavedContext.Provider
          value={{ state: unsavedState as never, setState: jest.fn() }}
        >
          <DiscussionCard
            id="card-0"
            discussion={discussion}
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
};

describe('DiscussionCard locate scroll (TT-7887)', () => {
  const scrollIntoView = jest.fn();

  beforeAll(() => {
    // jsdom does not implement scrollIntoView.
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  beforeEach(() => {
    (useGlobal as jest.Mock).mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        user: 'user-1',
        memory: { update: jest.fn(), cache: { query: () => [] } },
        organization: 'org-1',
        offline: false,
        offlineOnly: false,
      };
      return [values[key], jest.fn()];
    });
  });

  const cardScrolls = () =>
    scrollIntoView.mock.contexts.filter(
      (el) => el === document.getElementById('card-0')
    );

  it('scrolls its header to the top of the list when its region is located', () => {
    render(cardTree(0));

    expect(cardScrolls()).toHaveLength(1);
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'start' })
    );
  });

  it('scrolls again when the same region is located a second time', () => {
    const { rerender } = render(cardTree(0));
    expect(cardScrolls()).toHaveLength(1);

    // The user scrolls the list away, then hits the same locate again:
    // PassageDetailContext keeps highlightDiscussion and bumps refresh.
    rerender(cardTree(1));

    expect(cardScrolls()).toHaveLength(2);
  });
});
