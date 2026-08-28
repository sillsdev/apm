import { describe, expect, it, beforeEach } from '@jest/globals';
import { RecordSchema } from '@orbit/records';
import MemorySource from '@orbit/memory';
import { related } from '../../crud/related';
import { restoreAfterPendingUpload } from './restoreAfterPendingUpload';
import type { PendingUploadRestore } from './pendingMediaUploads';

const schema = new RecordSchema({
  models: {
    user: {
      attributes: {},
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    organization: {
      attributes: {},
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    mediafile: {
      attributes: {
        transcription: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    intellectualproperty: {
      attributes: {
        rightsHolder: { type: 'string' },
        notes: { type: 'string' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        organization: { kind: 'hasOne', type: 'organization' },
        releaseMediafile: { kind: 'hasOne', type: 'mediafile' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    discussion: {
      attributes: {
        dateUpdated: { type: 'string' },
      },
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
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
    section: {
      attributes: {
        name: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        titleMediafile: { kind: 'hasOne', type: 'mediafile' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
  },
});

describe('restoreAfterPendingUpload (TT-7363)', () => {
  let memory: MemorySource;
  const user = 'user-1';

  beforeEach(async () => {
    memory = new MemorySource({ schema });
    await memory.update((t) => [
      t.addRecord({ type: 'user', id: user, attributes: {} }),
      t.addRecord({
        type: 'organization',
        id: 'org-1',
        attributes: {},
      }),
      t.addRecord({
        type: 'mediafile',
        id: 'media-1',
        attributes: { transcription: '' },
      }),
      t.addRecord({
        type: 'discussion',
        id: 'disc-1',
        attributes: {},
      }),
      t.addRecord({
        type: 'section',
        id: 'sec-1',
        attributes: { name: 'Section 1' },
        relationships: {
          titleMediafile: { data: null },
        },
      }),
    ]);
  });

  it('creates intellectualproperty linked to the mediafile and org', async () => {
    const restore: PendingUploadRestore = {
      kind: 'intellectualproperty',
      rightsHolder: 'Speaker info test',
      organizationId: 'org-1',
      notes: '{"fullName":"Speaker info test"}',
    };

    await restoreAfterPendingUpload({
      mediaId: 'media-1',
      restore,
      memory,
      user,
    });

    const ips = memory.cache.query((q) =>
      q.findRecords('intellectualproperty')
    ) as unknown as Array<{
      attributes: { rightsHolder: string };
      relationships?: Record<string, { data: { id: string } | null }>;
    }>;
    expect(ips).toHaveLength(1);
    expect(ips[0].attributes.rightsHolder).toBe('Speaker info test');
    expect(related(ips[0], 'releaseMediafile')).toBe('media-1');
    expect(related(ips[0], 'organization')).toBe('org-1');
  });

  it('creates a comment under the discussion and links mediafile', async () => {
    const restore: PendingUploadRestore = {
      kind: 'comment',
      discussionId: 'disc-1',
      text: 'audio comment note',
      visible: JSON.stringify({
        consultantInTraining: true,
        mentor: true,
        approved: false,
        author: 'user-1',
      }),
    };

    await restoreAfterPendingUpload({
      mediaId: 'media-1',
      restore,
      memory,
      user,
    });

    const comments = memory.cache.query((q) =>
      q.findRecords('comment')
    ) as unknown as Array<{
      attributes: { commentText: string; visible: string };
    }>;
    expect(comments).toHaveLength(1);
    expect(comments[0].attributes.commentText).toBe('audio comment note');
    expect(comments[0].attributes.visible).toBe(restore.visible);
    expect(related(comments[0], 'discussion')).toBe('disc-1');
    expect(related(comments[0], 'mediafile')).toBe('media-1');
  });

  it('updates an existing comment and links mediafile', async () => {
    await memory.update((t) =>
      t.addRecord({
        type: 'comment',
        id: 'cmt-1',
        attributes: { commentText: 'old', visible: '{}' },
        relationships: {
          discussion: { data: { type: 'discussion', id: 'disc-1' } },
          mediafile: { data: null },
        },
      })
    );

    const restore: PendingUploadRestore = {
      kind: 'comment',
      discussionId: 'disc-1',
      commentId: 'cmt-1',
      text: 'updated text',
      visible: JSON.stringify({
        consultantInTraining: true,
        mentor: true,
        approved: true,
        author: 'user-1',
      }),
    };

    await restoreAfterPendingUpload({
      mediaId: 'media-1',
      restore,
      memory,
      user,
    });

    const comment = memory.cache.getRecordSync({
      type: 'comment',
      id: 'cmt-1',
    }) as unknown as { attributes: { commentText: string; visible: string } };
    expect(comment.attributes.commentText).toBe('updated text');
    expect(comment.attributes.visible).toBe(restore.visible);
    expect(related(comment, 'mediafile')).toBe('media-1');
  });

  it('sets section.titleMediafile to the restored media id', async () => {
    const restore: PendingUploadRestore = {
      kind: 'title',
      sectionId: 'sec-1',
    };

    await restoreAfterPendingUpload({
      mediaId: 'media-1',
      restore,
      memory,
      user,
    });

    const section = memory.cache.getRecordSync({
      type: 'section',
      id: 'sec-1',
    });
    expect(related(section, 'titleMediafile')).toBe('media-1');
  });
});
