import { describe, expect, it, beforeEach } from '@jest/globals';
import { RecordSchema } from '@orbit/records';
import MemorySource from '@orbit/memory';
import { related } from '../../crud/related';
import { restoreAfterPendingUpload } from './restoreAfterPendingUpload';
import type { PendingUploadRestore } from './pendingMediaUploads';
import {
  getRecordingForClause,
  getCompletedClauseIndices,
} from '../../components/PassageDetail/carefulSpeech/carefulSpeechCompletion';
import { IRegion } from '../../crud/useWavesurferRegions';
import { IRow } from '../../context/PassageDetailContext';

const clauseRegion: IRegion = { start: 0, end: 10, label: '' };

const schema = new RecordSchema({
  models: {
    user: {
      attributes: {},
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    section: {
      attributes: {
        name: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    passage: {
      attributes: {},
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    orgworkflowstep: {
      attributes: {},
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    artifacttype: {
      attributes: { typename: { type: 'string' } },
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    artifactcategory: {
      attributes: { categoryname: { type: 'string' } },
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    mediafile: {
      attributes: {
        sourceSegments: { type: 'string' },
        originalFile: { type: 'string' },
        versionNumber: { type: 'number' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        artifactType: { kind: 'hasOne', type: 'artifacttype' },
        sourceMedia: { kind: 'hasOne', type: 'mediafile' },
        passage: { kind: 'hasOne', type: 'passage' },
        artifactCategory: { kind: 'hasOne', type: 'artifactcategory' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    sectionresource: {
      attributes: {
        sequenceNum: { type: 'number' },
        description: { type: 'string' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        section: { kind: 'hasOne', type: 'section' },
        mediafile: { kind: 'hasOne', type: 'mediafile' },
        passage: { kind: 'hasOne', type: 'passage' },
        orgWorkflowStep: { kind: 'hasOne', type: 'orgworkflowstep' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
  },
});

function makeLwcRow(
  overrides: Partial<IRow> & {
    id: string;
    sourceMediaId?: string;
    sourceSegments?: string;
  }
): IRow {
  const {
    id,
    sourceMediaId,
    sourceSegments = JSON.stringify({ start: 0, end: 10 }),
    ...rest
  } = overrides;
  return {
    id,
    artifactType: 'LWC translation',
    sourceVersion: 1,
    mediafile: {
      id: `${id}-mf`,
      type: 'mediafile',
      attributes: { sourceSegments, versionNumber: 1 },
      relationships: {
        artifactType: { data: { id: 'lwc-art', type: 'artifacttype' } },
        ...(sourceMediaId
          ? { sourceMedia: { data: { id: sourceMediaId, type: 'mediafile' } } }
          : {}),
      },
    } as IRow['mediafile'],
    ...rest,
  } as IRow;
}

describe('pending upload retry gaps (TT-7363 reopen)', () => {
  let memory: MemorySource;
  const user = 'user-1';

  beforeEach(async () => {
    memory = new MemorySource({ schema });
    await memory.update((t) => [
      t.addRecord({ type: 'user', id: user, attributes: {} }),
      t.addRecord({
        type: 'section',
        id: 'sec-1',
        attributes: { name: 'Section 1' },
      }),
      t.addRecord({ type: 'passage', id: 'pas-1', attributes: {} }),
      t.addRecord({ type: 'orgworkflowstep', id: 'ows-1', attributes: {} }),
      t.addRecord({
        type: 'artifacttype',
        id: 'res-art',
        attributes: { typename: 'resource' },
      }),
      t.addRecord({
        type: 'artifacttype',
        id: 'lwc-art',
        attributes: { typename: 'backtranslation' },
      }),
      t.addRecord({
        type: 'mediafile',
        id: 'vern-1',
        attributes: { versionNumber: 1 },
        relationships: {
          passage: { data: { type: 'passage', id: 'pas-1' } },
        },
      }),
      t.addRecord({
        type: 'mediafile',
        id: 'resource-media-1',
        attributes: {
          originalFile: 'resource.mp3',
          versionNumber: 1,
        },
        relationships: {
          artifactType: { data: { type: 'artifacttype', id: 'res-art' } },
          passage: { data: { type: 'passage', id: 'pas-1' } },
        },
      }),
      t.addRecord({
        type: 'mediafile',
        id: 'lwc-media-1',
        attributes: {
          sourceSegments: JSON.stringify({ start: 0, end: 10 }),
          versionNumber: 1,
        },
        relationships: {
          artifactType: { data: { type: 'artifacttype', id: 'lwc-art' } },
          passage: { data: { type: 'passage', id: 'pas-1' } },
        },
      }),
    ]);
  });

  describe('Resource — sectionresource secondary link', () => {
    it('creates sectionresource linked to section, mediafile, and org workflow step', async () => {
      const restore: PendingUploadRestore = {
        kind: 'sectionresource',
        sectionId: 'sec-1',
        description: 'My resource recording',
        sequenceNum: 1,
        orgWorkflowStepId: 'ows-1',
      };

      await restoreAfterPendingUpload({
        mediaId: 'resource-media-1',
        restore,
        memory,
        user,
      });

      const sectionResources = memory.cache.query((q) =>
        q.findRecords('sectionresource')
      ) as unknown as Array<{
        attributes?: { description?: string };
      }>;
      expect(sectionResources).toHaveLength(1);
      expect(related(sectionResources[0], 'section')).toBe('sec-1');
      expect(related(sectionResources[0], 'mediafile')).toBe('resource-media-1');
      expect(related(sectionResources[0], 'orgWorkflowStep')).toBe('ows-1');
      expect(sectionResources[0].attributes?.description).toBe(
        'My resource recording'
      );
    });

    it('links passage when restore meta includes passageId', async () => {
      const restore: PendingUploadRestore = {
        kind: 'sectionresource',
        sectionId: 'sec-1',
        description: 'Passage resource',
        sequenceNum: 2,
        orgWorkflowStepId: 'ows-1',
        passageId: 'pas-1',
      };

      await restoreAfterPendingUpload({
        mediaId: 'resource-media-1',
        restore,
        memory,
        user,
      });

      const sectionResources = memory.cache.query((q) =>
        q.findRecords('sectionresource')
      ) as unknown as Array<Record<string, unknown>>;
      expect(sectionResources).toHaveLength(1);
      expect(related(sectionResources[0], 'passage')).toBe('pas-1');
    });

    /**
     * Stale sequenceNum: pending meta freezes rowData.length+n at stage time,
     * while successful siblings (batch compact or later adds) already occupy it.
     * Restore must pick a free sequence for the section.
     */
    it('avoids duplicate sequenceNum when section already has that sequence', async () => {
      await memory.update((t) => [
        t.addRecord({
          type: 'mediafile',
          id: 'resource-media-existing',
          attributes: {
            originalFile: 'existing.mp3',
            versionNumber: 1,
          },
          relationships: {
            artifactType: { data: { type: 'artifacttype', id: 'res-art' } },
          },
        }),
        t.addRecord({
          type: 'sectionresource',
          id: 'sr-existing',
          attributes: {
            sequenceNum: 1,
            description: 'Already linked after compact upload',
          },
          relationships: {
            section: { data: { type: 'section', id: 'sec-1' } },
            mediafile: {
              data: { type: 'mediafile', id: 'resource-media-existing' },
            },
            orgWorkflowStep: {
              data: { type: 'orgworkflowstep', id: 'ows-1' },
            },
          },
        }),
      ]);

      const restore: PendingUploadRestore = {
        kind: 'sectionresource',
        sectionId: 'sec-1',
        description: 'Retried pending resource',
        // Stale: captured when rowData was empty / first in failed batch
        sequenceNum: 1,
        orgWorkflowStepId: 'ows-1',
      };

      await restoreAfterPendingUpload({
        mediaId: 'resource-media-1',
        restore,
        memory,
        user,
      });

      const sectionResources = (
        memory.cache.query((q) => q.findRecords('sectionresource')) as Array<{
          id: string;
          attributes?: { sequenceNum?: number; description?: string };
        }>
      ).filter((r) => related(r, 'section') === 'sec-1');

      expect(sectionResources).toHaveLength(2);
      const seqs = sectionResources.map((r) => r.attributes?.sequenceNum);
      expect(new Set(seqs).size).toBe(2);
      const restored = sectionResources.find(
        (r) => related(r, 'mediafile') === 'resource-media-1'
      );
      expect(restored?.attributes?.sequenceNum).toBe(2);
      expect(restored?.attributes?.description).toBe(
        'Retried pending resource'
      );
    });
  });

  describe('LWC Audio Translation — sourceMedia secondary link', () => {
    it('relinks sourceMedia on the pulled mediafile from pending restore meta', async () => {
      const restore: PendingUploadRestore = {
        kind: 'sourceMedia',
        sourceMediaId: 'vern-1',
      };

      await restoreAfterPendingUpload({
        mediaId: 'lwc-media-1',
        restore,
        memory,
        user,
      });

      const media = memory.cache.getRecordSync({
        type: 'mediafile',
        id: 'lwc-media-1',
      });
      expect(related(media, 'sourceMedia')).toBe('vern-1');
    });

    it('shows the LWC clause as recorded after sourceMedia is restored', async () => {
      const restore: PendingUploadRestore = {
        kind: 'sourceMedia',
        sourceMediaId: 'vern-1',
      };

      await restoreAfterPendingUpload({
        mediaId: 'lwc-media-1',
        restore,
        memory,
        user,
      });

      const media = memory.cache.getRecordSync({
        type: 'mediafile',
        id: 'lwc-media-1',
      });
      const row = makeLwcRow({
        id: 'lwc-row',
        sourceMediaId: related(media, 'sourceMedia') ?? undefined,
        sourceSegments: media?.attributes?.sourceSegments as string,
      });

      const completed = getCompletedClauseIndices(
        [clauseRegion],
        [row],
        'lwc-art',
        1,
        'vern-1'
      );
      expect(completed.has(0)).toBe(true);
      expect(
        getRecordingForClause(
          [row],
          'lwc-art',
          1,
          clauseRegion,
          'vern-1'
        )?.id
      ).toBe('lwc-row');
    });
  });
});
