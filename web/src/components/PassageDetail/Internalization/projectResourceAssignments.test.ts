import type Memory from '@orbit/memory';
import type { MediaFileD, SectionResourceD } from '../../../model';
import {
  countProjectResourceCopies,
  getProjectResourceAssignments,
  removeProjectResource,
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

const passageMedia = (
  id: string,
  passageId: string,
  artifactTypeId = 'resource-type'
) =>
  ({
    type: 'mediafile',
    id,
    attributes: {},
    relationships: {
      sourceMedia: relationship('mediafile', source.id),
      passage: relationship('passage', passageId),
      artifactType: relationship('artifacttype', artifactTypeId),
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
      resourceTypeId: 'resource-type',
    });

    expect(removeRecord).toHaveBeenCalledTimes(2);
    expect(removeRecord).toHaveBeenCalledWith(removedResource);
    expect(removeRecord).toHaveBeenCalledWith(removed);
  });

  it('leaves media derived for another artifact type alone', async () => {
    const backTranslation = passageMedia(
      'back-translation',
      'passage-2',
      'back-translation-type'
    );
    const removeRecord = jest.fn((record) => ({ op: 'removeRecord', record }));
    const memory = {
      update: jest.fn(async (callback) => callback({ removeRecord })),
    } as unknown as Memory;

    await removeUnselectedProjectResourceAssignments({
      memory,
      sourceMedia: source,
      selectedItems: [],
      mediafiles: [source, backTranslation],
      sectionResources: [],
      resourceTypeId: 'resource-type',
    });

    expect(removeRecord).not.toHaveBeenCalled();
    expect(
      getProjectResourceAssignments(
        source,
        [source, backTranslation],
        [],
        'resource-type'
      )
    ).toEqual([]);
  });

  it('leaves assignments the dialog never offered alone', async () => {
    const offered = passageMedia('offered-media', 'passage-1');
    const notOffered = passageMedia('other-plan-media', 'passage-9');
    const removeRecord = jest.fn((record) => ({ op: 'removeRecord', record }));
    const memory = {
      update: jest.fn(async (callback) => callback({ removeRecord })),
    } as unknown as Memory;

    await removeUnselectedProjectResourceAssignments({
      memory,
      sourceMedia: source,
      selectedItems: [],
      mediafiles: [source, offered, notOffered],
      sectionResources: [],
      candidateItems: [{ type: 'passage', id: 'passage-1' }],
      resourceTypeId: 'resource-type',
    });

    expect(removeRecord).toHaveBeenCalledTimes(1);
    expect(removeRecord).toHaveBeenCalledWith(offered);
  });

  it('deletes nothing when the derived artifact type id is unknown', async () => {
    const removable = passageMedia('removable-media', 'passage-1');
    const removeRecord = jest.fn((record) => ({ op: 'removeRecord', record }));
    const memory = {
      update: jest.fn(async (callback) => callback({ removeRecord })),
    } as unknown as Memory;

    await removeUnselectedProjectResourceAssignments({
      memory,
      sourceMedia: source,
      selectedItems: [],
      mediafiles: [source, removable],
      sectionResources: [],
      // resourceTypeId omitted: cannot distinguish our copies from other media
      // sharing sourceMedia, so cleanup must be a no-op rather than risk
      // deleting unrelated records.
    });

    expect(removeRecord).not.toHaveBeenCalled();
  });

  it('counts every media derived from the source', () => {
    const mediafiles = [
      source,
      passageMedia('a', 'passage-1'),
      passageMedia('b', 'passage-2', 'other-type'),
      sectionMedia,
    ];
    expect(countProjectResourceCopies(source, mediafiles)).toBe(3);
    expect(countProjectResourceCopies(undefined, mediafiles)).toBe(0);
  });

  it('removes every derived media, its section resource, and the source', async () => {
    const passageCopy = passageMedia('passage-copy', 'passage-1');
    const otherTypeCopy = passageMedia('other-copy', 'passage-2', 'other-type');
    const unrelated = { ...passageCopy, id: 'unrelated', relationships: {} };
    const mediafiles = [
      source,
      passageCopy,
      otherTypeCopy,
      sectionMedia,
      unrelated as MediaFileD,
    ];
    const removeRecord = jest.fn((record) => ({ op: 'removeRecord', record }));
    const memory = {
      update: jest.fn(async (callback) => callback({ removeRecord })),
    } as unknown as Memory;

    const removedIds = await removeProjectResource({
      memory,
      sourceMedia: source,
      mediafiles,
      sectionResources: [sectionResource],
    });

    expect(removedIds).toEqual([
      passageCopy.id,
      otherTypeCopy.id,
      sectionMedia.id,
    ]);
    // The dialog's count is exactly what gets deleted.
    expect(removedIds).toHaveLength(
      countProjectResourceCopies(source, mediafiles)
    );
    expect(removeRecord).toHaveBeenCalledTimes(5);
    expect(removeRecord).toHaveBeenCalledWith(sectionResource);
    expect(removeRecord).toHaveBeenCalledWith(source);
    expect(removeRecord).not.toHaveBeenCalledWith(unrelated);
  });
});
