import { describe, expect, it, beforeEach } from '@jest/globals';
import { RecordSchema } from '@orbit/records';
import MemorySource from '@orbit/memory';
import { related } from '../../../crud/related';
import { restoreAfterPendingUpload } from '../../../store/upload/restoreAfterPendingUpload';
import { findPromptRow } from './usePromptSectionResource';
import { promptPendingRestore } from './promptPendingRestore';
import { IRow } from '../../../context/PassageDetailContext';
import { SectionD, SectionResourceD } from '../../../model';

const schema = new RecordSchema({
  models: {
    user: {
      attributes: {},
      relationships: {
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    section: {
      attributes: { name: { type: 'string' } },
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
    mediafile: {
      attributes: {
        originalFile: { type: 'string' },
        versionNumber: { type: 'number' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
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

describe('promptPendingRestore (TT-7724)', () => {
  it('returns sectionresource restore meta for Prompt recordings', () => {
    expect(
      promptPendingRestore({
        sectionId: 'sec-1',
        orgWorkflowStepId: 'prompt-step',
      })
    ).toEqual({
      kind: 'sectionresource',
      sectionId: 'sec-1',
      description: null,
      sequenceNum: 0,
      orgWorkflowStepId: 'prompt-step',
    });
  });

  it('returns undefined without section or step', () => {
    expect(
      promptPendingRestore({ sectionId: '', orgWorkflowStepId: 'prompt-step' })
    ).toBeUndefined();
    expect(
      promptPendingRestore({ sectionId: 'sec-1', orgWorkflowStepId: '' })
    ).toBeUndefined();
  });

  describe('after Retry restore', () => {
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
        t.addRecord({
          type: 'orgworkflowstep',
          id: 'prompt-step',
          attributes: {},
        }),
        t.addRecord({
          type: 'mediafile',
          id: 'prompt-media-1',
          attributes: { originalFile: 'prompt.mp3', versionNumber: 1 },
        }),
      ]);
    });

    it('makes findPromptRow see the restored Prompt audio', async () => {
      const restore = promptPendingRestore({
        sectionId: 'sec-1',
        orgWorkflowStepId: 'prompt-step',
      });
      expect(restore).toBeDefined();

      await restoreAfterPendingUpload({
        mediaId: 'prompt-media-1',
        restore: restore!,
        memory,
        user,
      });

      const sectionResources = memory.cache.query((q) =>
        q.findRecords('sectionresource')
      ) as SectionResourceD[];
      expect(sectionResources).toHaveLength(1);

      const sr = sectionResources[0];
      const row = {
        id: 'prompt-media-1',
        sequenceNum: sr.attributes?.sequenceNum ?? 0,
        isResource: true,
        isText: false,
        passageId: '',
        resource: sr,
        mediafile: {
          id: 'prompt-media-1',
          type: 'mediafile',
          attributes: {},
        },
      } as IRow;

      const section = { id: 'sec-1', type: 'section' } as SectionD;
      expect(findPromptRow([row], section, 'prompt-step')?.id).toBe(
        'prompt-media-1'
      );
      expect(related(sr, 'mediafile')).toBe('prompt-media-1');
    });
  });
});
