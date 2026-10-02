/**
 * TT-7717: Add Discussion with topic + text + paused audio → Add.
 *
 * TT-7363 saves the discussion to Orbit before the audio upload starts so
 * pending-upload Retry has a discussionId. That assigns `discussion.id` on the
 * draft card. If StyledCard uses `key={discussion.id}`, React remounts
 * CommentEditor / MediaRecord mid-save — the recording disappears, Saving
 * sticks, and the text/audio comment never attaches.
 *
 * CommentEditor is mocked (real MUI `focused` TextField loops in jsdom) but
 * still mounts under StyledCard, so a remount bumps the mount counter.
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

let commentEditorMounts = 0;
let commentEditorUnmounts = 0;
let latestAfterUploadCb:
  ((mediaId: string | undefined) => Promise<void>) | undefined;

jest.mock('./CommentEditor', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  const MockCommentEditor = (props: {
    toolId: string;
    afterUploadCb: (mediaId: string | undefined) => Promise<void>;
    setCanSaveRecording: (canSave: boolean) => void;
    onAudioDraftChange?: (hasDraft: boolean) => void;
    onTextChange: (txt: string) => void;
    comment: string;
  }) => {
    latestAfterUploadCb = props.afterUploadCb;

    R.useEffect(() => {
      commentEditorMounts += 1;
      props.onTextChange(props.comment || 'Comment Php 1:18b-26');
      props.setCanSaveRecording(true);
      props.onAudioDraftChange?.(true);
      return () => {
        commentEditorUnmounts += 1;
      };
    }, []);

    // Upload completion is driven by the test via latestAfterUploadCb so we can
    // assert remount *before* afterUploadCb runs (and fail the latch path).

    return <div data-testid="comment-editor" />;
  };
  MockCommentEditor.displayName = 'MockCommentEditor';
  return { CommentEditor: MockCommentEditor };
});

jest.mock('../../utils', () => ({
  waitForIt: () => Promise.resolve(),
  useWaitForRemoteQueue: () => () => Promise.resolve(),
  removeExtension: (name: string) => ({ name, ext: '' }),
  startEnd: () => undefined,
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
  Button: (props: {
    id?: string;
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button
      id={props.id}
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
    >
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

// Avoid MUI TextField autoFocus / focused loops in jsdom.
jest.mock('@mui/material', () => {
  const actual = jest.requireActual(
    '@mui/material'
  ) as typeof import('@mui/material');
  const TextField = (props: {
    id?: string;
    value?: string;
    onChange?: (e: { target: { value: string } }) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <input
      id={props.id}
      value={props.value ?? ''}
      placeholder={props.placeholder}
      disabled={props.disabled}
      onChange={(e) => props.onChange?.({ target: { value: e.target.value } })}
    />
  );
  return { ...actual, TextField };
});

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemorySource from '@orbit/memory';
import { RecordSchema } from '@orbit/records';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { UnsavedContext, SaveInfo } from '../../context/UnsavedContext';
import { useGlobal } from '../../context/useGlobal';
import { DiscussionCard } from './DiscussionCard';
import { DiscussionD } from '../../model';

const theme = createTheme();

const schema = new RecordSchema({
  models: {
    user: {
      attributes: {},
      relationships: { lastModifiedByUser: { kind: 'hasOne', type: 'user' } },
    },
    mediafile: {
      attributes: {
        originalFile: { type: 'string' },
        versionNumber: { type: 'number' },
        duration: { type: 'number' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        passage: { kind: 'hasOne', type: 'passage' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    passage: { attributes: {}, relationships: {} },
    discussion: {
      attributes: {
        subject: { type: 'string' },
        resolved: { type: 'boolean' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        mediafile: { kind: 'hasOne', type: 'mediafile' },
        orgWorkflowStep: { kind: 'hasOne', type: 'orgworkflowstep' },
        artifactCategory: { kind: 'hasOne', type: 'artifactcategory' },
        group: { kind: 'hasOne', type: 'group' },
        user: { kind: 'hasOne', type: 'user' },
        creatorUser: { kind: 'hasOne', type: 'user' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    orgworkflowstep: { attributes: {}, relationships: {} },
    artifactcategory: { attributes: {}, relationships: {} },
    group: { attributes: {}, relationships: {} },
    comment: {
      attributes: {
        commentText: { type: 'string' },
        visible: { type: 'string' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        discussion: { kind: 'hasOne', type: 'discussion' },
        mediafile: { kind: 'hasOne', type: 'mediafile' },
        creatorUser: { kind: 'hasOne', type: 'user' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
  },
});

type ToolsMap = Record<string, SaveInfo>;

function TestUnsavedProvider({ children }: { children: React.ReactNode }) {
  const toolsRef = useRef<ToolsMap>({});
  const [toolsChanged, setToolsChanged] = useState<ToolsMap>({});

  const sync = useCallback(() => {
    setToolsChanged({ ...toolsRef.current });
  }, []);

  const toolChanged = useCallback(
    (toolId: string, changed: boolean = true) => {
      if (changed) {
        if (toolsRef.current[toolId]) return;
        toolsRef.current[toolId] = {
          startSave: false,
          clearChanged: false,
          saveError: '',
        };
      } else {
        if (!toolsRef.current[toolId]) return;
        delete toolsRef.current[toolId];
      }
      sync();
    },
    [sync]
  );

  const startSave = useCallback(
    (toolId?: string) => {
      if (!toolId) return;
      if (toolsRef.current[toolId]?.startSave) return;
      toolsRef.current[toolId] = {
        startSave: true,
        clearChanged: false,
        saveError: '',
      };
      sync();
    },
    [sync]
  );

  const saveCompleted = useCallback(
    (toolId: string) => {
      if (!toolsRef.current[toolId]) return;
      delete toolsRef.current[toolId];
      sync();
    },
    [sync]
  );

  const state = useMemo(
    () => ({
      toolChanged,
      toolsChanged,
      saveCompleted,
      saveRequested: (toolId: string) =>
        Boolean(toolsRef.current[toolId]?.startSave),
      clearRequested: () => false,
      clearCompleted: saveCompleted,
      startSave,
      startClear: jest.fn(),
      isChanged: (toolId: string) =>
        toolsRef.current[toolId] !== undefined &&
        !toolsRef.current[toolId].clearChanged,
    }),
    [toolChanged, toolsChanged, saveCompleted, startSave]
  );

  return (
    <UnsavedContext.Provider
      value={{ state: state as never, setState: jest.fn() }}
    >
      {children}
    </UnsavedContext.Provider>
  );
}

describe('DiscussionCard add save (TT-7717)', () => {
  let memory: MemorySource;
  const user = 'user-1';
  const onAddComplete = jest.fn();

  beforeEach(async () => {
    commentEditorMounts = 0;
    commentEditorUnmounts = 0;
    latestAfterUploadCb = undefined;
    mockSaveComment.mockClear();
    onAddComplete.mockClear();

    memory = new MemorySource({ schema });
    await memory.update((t) => [
      t.addRecord({ type: 'user', id: user, attributes: {} }),
      t.addRecord({
        type: 'mediafile',
        id: 'vern-1',
        attributes: {
          originalFile: 'vern.wav',
          versionNumber: 1,
          duration: 47,
        },
        relationships: {
          passage: { data: { type: 'passage', id: 'passage-1' } },
        },
      }),
      t.addRecord({ type: 'passage', id: 'passage-1', attributes: {} }),
    ]);

    (useGlobal as jest.Mock).mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        user,
        memory,
        organization: 'org-1',
        offline: false,
        offlineOnly: false,
      };
      return [values[key], jest.fn()];
    });
  });

  const draftDiscussion = () =>
    ({
      type: 'discussion',
      attributes: { subject: '', resolved: false },
    }) as DiscussionD;

  const renderCard = (discussion: DiscussionD) => {
    const passageState = {
      currentstep: 'step-mark',
      playerMediafile: {
        id: 'vern-1',
        attributes: { duration: 47, originalFile: 'vern.wav' },
      },
      setPlayerSegments: jest.fn(),
      currentSegment: '',
      handleHighlightDiscussion: jest.fn(),
      highlightDiscussion: undefined,
      refresh: 0,
    };

    return render(
      <ThemeProvider theme={theme}>
        <PassageDetailContext.Provider
          value={{ state: passageState as never, setState: jest.fn() }}
        >
          <TestUnsavedProvider>
            <DiscussionCard
              id="card-0"
              discussion={discussion}
              collapsed={false}
              showStep={false}
              showReference={false}
              onAddComplete={onAddComplete}
              setRef={jest.fn()}
              requestHighlight=""
              refreshList={jest.fn()}
            />
          </TestUnsavedProvider>
        </PassageDetailContext.Provider>
      </ThemeProvider>
    );
  };

  it('keeps CommentEditor mounted and saves text+audio comment when Add is clicked', async () => {
    const userUx = userEvent.setup();
    const discussion = draftDiscussion();
    renderCard(discussion);

    await waitFor(() => {
      expect(screen.getByTestId('comment-editor')).toBeInTheDocument();
    });
    expect(commentEditorMounts).toBe(1);

    await userUx.type(screen.getByPlaceholderText('Topic'), 'Php 1:18b-26');

    await waitFor(() => {
      const addBtn = document.getElementById(
        'ok-undefined'
      ) as HTMLButtonElement;
      expect(addBtn?.disabled).toBe(false);
    });

    await act(async () => {
      document.getElementById('ok-undefined')?.click();
    });

    // After TT-7363 early saveDiscussion, discussion.id is assigned. A keyed
    // remount would bump mounts above 1 before the upload finishes.
    await waitFor(() => {
      expect(discussion.id).toBeTruthy();
    });
    expect(commentEditorMounts).toBe(1);
    expect(commentEditorUnmounts).toBe(0);
    expect(screen.getByTestId('comment-editor')).toBeInTheDocument();

    await act(async () => {
      await latestAfterUploadCb?.('comment-media-1');
    });

    await waitFor(() => {
      expect(onAddComplete).toHaveBeenCalledWith(discussion.id);
    });
    expect(mockSaveComment).toHaveBeenCalledWith(
      discussion.id,
      '',
      'Comment Php 1:18b-26',
      'comment-media-1',
      undefined
    );
  });

  it('releases the Add latch when the audio upload returns no media id', async () => {
    const userUx = userEvent.setup();
    const discussion = draftDiscussion();
    renderCard(discussion);

    await waitFor(() => {
      expect(screen.getByTestId('comment-editor')).toBeInTheDocument();
      expect(latestAfterUploadCb).toBeDefined();
    });

    await userUx.type(screen.getByPlaceholderText('Topic'), 'Topic only');

    await act(async () => {
      document.getElementById('ok-undefined')?.click();
    });

    await waitFor(() => {
      expect(discussion.id).toBeTruthy();
    });

    await act(async () => {
      await latestAfterUploadCb?.(undefined);
    });

    await waitFor(() => {
      const cancel = document.querySelector(
        '[id^="cancel-"]'
      ) as HTMLButtonElement | null;
      expect(cancel).toBeTruthy();
      expect(cancel?.disabled).toBe(false);
    });
  });
});
