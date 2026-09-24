import type Memory from '@orbit/memory';
import type { MediaFileD, SectionResourceD } from '../../../model';
import {
  countProjectResourceCopies,
  getGeneralResourceSource,
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

  it('resolves a derived copy to its general resource source', () => {
    const generalSource = {
      ...source,
      relationships: {
        artifactType: relationship('artifacttype', 'proj-type'),
      },
    } as MediaFileD;
    const copy = passageMedia('copy', 'passage-1');
    const mediafiles = [generalSource, copy];

    expect(getGeneralResourceSource(copy, mediafiles, 'proj-type')).toBe(
      generalSource
    );
    // Rows never show the general resource itself, so it has no source.
    expect(
      getGeneralResourceSource(generalSource, mediafiles, 'proj-type')
    ).toBe(undefined);
    // Copies of some other (non-general) source are not general resources.
    expect(getGeneralResourceSource(copy, [source, copy], 'proj-type')).toBe(
      undefined
    );
  });

  it('counts only resource-type copies of the source', () => {
    const mediafiles = [
      source,
      passageMedia('a', 'passage-1'),
      passageMedia('b', 'passage-2'),
      passageMedia('bt', 'passage-2', 'back-translation-type'),
    ];
    expect(
      countProjectResourceCopies(source, mediafiles, 'resource-type')
    ).toBe(2);
    expect(
      countProjectResourceCopies(undefined, mediafiles, 'resource-type')
    ).toBe(0);
  });

  it('removes every copy, its section resource, and the source', async () => {
    const passageCopy = passageMedia('passage-copy', 'passage-1');
    const sectionCopy = {
      ...sectionMedia,
      relationships: {
        ...sectionMedia.relationships,
        artifactType: relationship('artifacttype', 'resource-type'),
      },
    } as MediaFileD;
    const backTranslation = passageMedia(
      'back-translation',
      'passage-2',
      'back-translation-type'
    );
    const removeRecord = jest.fn((record) => ({ op: 'removeRecord', record }));
    const memory = {
      update: jest.fn(async (callback) => callback({ removeRecord })),
    } as unknown as Memory;

    await removeProjectResource({
      memory,
      sourceMedia: source,
      mediafiles: [source, passageCopy, sectionCopy, backTranslation],
      sectionResources: [sectionResource],
      resourceTypeId: 'resource-type',
    });

    expect(removeRecord).toHaveBeenCalledTimes(4);
    expect(removeRecord).toHaveBeenCalledWith(passageCopy);
    expect(removeRecord).toHaveBeenCalledWith(sectionResource);
    expect(removeRecord).toHaveBeenCalledWith(sectionCopy);
    expect(removeRecord).toHaveBeenCalledWith(source);
    expect(removeRecord).not.toHaveBeenCalledWith(backTranslation);
  });
});
