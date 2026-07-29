import type Memory from '@orbit/memory';
import type { MediaFileD, SectionResourceD } from '../../../model';
import {
  getProjectResourceAssignments,
  removeUnselectedProjectResourceAssignments,
} from './projectResourceAssignments';

const relationship = (type: string, id: string) => ({
  data: { type, id },
});

const source = {
  type: 'mediafile',
  id: 'source',
  attributes: {},
  relationships: {},
} as MediaFileD;

const passageMedia = (id: string, passageId: string) =>
  ({
    type: 'mediafile',
    id,
    attributes: {},
    relationships: {
      sourceMedia: relationship('mediafile', source.id),
      passage: relationship('passage', passageId),
    },
  }) as MediaFileD;

const sectionMedia = {
  type: 'mediafile',
  id: 'section-media',
  attributes: {},
  relationships: {
    sourceMedia: relationship('mediafile', source.id),
  },
} as MediaFileD;

const sectionResource = {
  type: 'sectionresource',
  id: 'section-resource',
  attributes: {},
  relationships: {
    mediafile: relationship('mediafile', sectionMedia.id),
    section: relationship('section', 'section-1'),
  },
} as SectionResourceD;

describe('project resource assignments', () => {
  it('maps derived media to passage and section identities', () => {
    expect(
      getProjectResourceAssignments(
        source,
        [source, passageMedia('passage-media', 'passage-1'), sectionMedia],
        [sectionResource]
      )
    ).toEqual([
      { type: 'passage', id: 'passage-1' },
      { type: 'section', id: 'section-1' },
    ]);
  });

  it('removes media and section resources for unchecked assignments', async () => {
    const kept = passageMedia('kept-media', 'passage-1');
    const removed = passageMedia('removed-media', 'passage-2');
    const removedResource = {
      ...sectionResource,
      id: 'removed-resource',
      relationships: {
        ...sectionResource.relationships,
        mediafile: relationship('mediafile', removed.id),
        passage: relationship('passage', 'passage-2'),
      },
    } as SectionResourceD;
    const removeRecord = jest.fn((record) => ({ op: 'removeRecord', record }));
    const memory = {
      update: jest.fn(async (callback) => callback({ removeRecord })),
    } as unknown as Memory;

    await removeUnselectedProjectResourceAssignments({
      memory,
      sourceMedia: source,
      selectedItems: [{ type: 'passage', id: 'passage-1' }],
      mediafiles: [source, kept, removed],
      sectionResources: [removedResource],
    });

    expect(removeRecord).toHaveBeenCalledTimes(2);
    expect(removeRecord).toHaveBeenCalledWith(removedResource);
    expect(removeRecord).toHaveBeenCalledWith(removed);
  });
});
