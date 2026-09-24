import type { RecordIdentity } from '@orbit/records';
import type Memory from '@orbit/memory';
import { related } from '../../../crud/related';
import type {
  MediaFile,
  MediaFileD,
  SectionResource,
  SectionResourceD,
} from '../../../model';

/** Stable `type:id` key for comparing {@link RecordIdentity} values in a Set. */
const identityKey = (identity: RecordIdentity) =>
  `${identity.type}:${identity.id}`;

/**
 * Copies of a general resource made for a passage/section.
 *
 * `sourceMedia` alone is not enough: back translations, consultant check
 * recordings and offline copies also point at their source through it, so the
 * artifact type of the derived copy (`resource`, see `useProjectResourceSave`)
 * must match as well when the caller knows it.
 */
const derivedResourceMedia = (
  sourceMedia: MediaFile,
  mediafiles: MediaFile[],
  resourceTypeId?: string | null
) =>
  mediafiles.filter(
    (media) =>
      related(media, 'sourceMedia') === sourceMedia.id &&
      (!resourceTypeId || related(media, 'artifactType') === resourceTypeId)
  );

/**
 * Resolves which passages/sections a project-resource media file is already
 * assigned to.
 *
 * Walks mediafiles derived from `sourceMedia` (`sourceMedia` relationship).
 * Passage-scoped copies map to `{ type: 'passage', id }`; section-scoped copies
 * map via their SectionResource to `{ type: 'section', id }`.
 *
 * Used as `SelectSections` `initialItems` when editing an audio project resource
 * so existing assignments stay checked.
 */
export const getProjectResourceAssignments = (
  sourceMedia: MediaFile | undefined,
  mediafiles: MediaFile[],
  sectionResources: SectionResource[],
  resourceTypeId?: string | null
) => {
  if (!sourceMedia) return [];

  return derivedResourceMedia(sourceMedia, mediafiles, resourceTypeId).flatMap(
    (media) => {
      const passageId = related(media, 'passage');
      if (passageId) return [{ type: 'passage', id: passageId }];

      const sectionResource = sectionResources.find(
        (resource) => related(resource, 'mediafile') === media.id
      );
      const sectionId = related(sectionResource, 'section');
      return sectionId ? [{ type: 'section', id: sectionId }] : [];
    }
  ) as RecordIdentity[];
};

interface RemoveAssignmentsProps {
  memory: Memory;
  sourceMedia: MediaFile | undefined;
  selectedItems: RecordIdentity[];
  mediafiles: MediaFile[];
  sectionResources: SectionResource[];
  /** Artifact type id of a derived resource copy (`resource` slug). */
  resourceTypeId?: string | null;
  /**
   * Every identity the selection dialog offered. Assignments outside this set
   * were never shown to the user (another plan, a passage type the dialog
   * filters out, passages in a flat plan) so they must not be deleted.
   * Omit to consider every derived copy a candidate.
   */
  candidateItems?: RecordIdentity[];
}

/**
 * Deletes derived media (and linked SectionResources) for assignments the user
 * unchecked.
 *
 * After new selections are saved, any prior derived mediafile for `sourceMedia`
 * whose passage/section was offered by the dialog but is not in `selectedItems`
 * is removed from Orbit memory (SectionResource first when present, then the
 * mediafile).
 */
export const removeUnselectedProjectResourceAssignments = async ({
  memory,
  sourceMedia,
  selectedItems,
  mediafiles,
  sectionResources,
  resourceTypeId,
  candidateItems,
}: RemoveAssignmentsProps) => {
  if (!sourceMedia) return;
  // Without the derived-resource artifact type we cannot tell our own copies
  // apart from other media that merely share `sourceMedia` (back translations,
  // consultant checks, offline copies). Deleting then would destroy unrelated
  // records, so skip cleanup entirely until the type id is known.
  if (!resourceTypeId) return;

  const selected = new Set(selectedItems.map(identityKey));
  const candidates = candidateItems && new Set(candidateItems.map(identityKey));
  const derivedMedia = derivedResourceMedia(
    sourceMedia,
    mediafiles,
    resourceTypeId
  );
  const records: Array<MediaFileD | SectionResourceD> = [];
  derivedMedia.forEach((media) => {
    const sectionResource = sectionResources.find(
      (resource) => related(resource, 'mediafile') === media.id
    ) as SectionResourceD | undefined;
    const passageId = related(media, 'passage');
    const sectionId = related(sectionResource, 'section');
    const assignment = passageId
      ? { type: 'passage', id: passageId }
      : sectionId
        ? { type: 'section', id: sectionId }
        : undefined;

    if (!assignment) return;
    const key = identityKey(assignment);
    if (selected.has(key)) return;
    if (candidates && !candidates.has(key)) return;
    if (sectionResource) records.push(sectionResource);
    records.push(media as MediaFileD);
  });

  if (records.length > 0) {
    await memory.update((transform) =>
      records.map((record) => transform.removeRecord(record))
    );
  }
};

/**
 * Resolves the general (project) resource behind a resource row.
 *
 * A row shows a derived copy whose `sourceMedia` is the general
 * resource. Returns that source, or undefined when the row is not such a copy.
 */
export const getGeneralResourceSource = <T extends MediaFile>(
  media: T | undefined,
  mediafiles: T[],
  projResourceTypeId?: string | null
): T | undefined => {
  if (!media || !projResourceTypeId) return undefined;
  const sourceMedia = mediafiles.find(
    (m) => m.id === related(media, 'sourceMedia')
  );
  return sourceMedia &&
    related(sourceMedia, 'artifactType') === projResourceTypeId
    ? sourceMedia
    : undefined;
};

/** Number of passage/section copies a general resource was split into. */
export const countProjectResourceCopies = (
  sourceMedia: MediaFile | undefined,
  mediafiles: MediaFile[],
  resourceTypeId?: string | null
) =>
  sourceMedia
    ? derivedResourceMedia(sourceMedia, mediafiles, resourceTypeId).length
    : 0;

interface RemoveProjectResourceProps {
  memory: Memory;
  sourceMedia: MediaFileD;
  mediafiles: MediaFile[];
  sectionResources: SectionResource[];
  /** Artifact type id of a derived resource copy (`resource` slug). */
  resourceTypeId?: string | null;
}

/**
 * Deletes an entire general resource: every derived copy (and its
 * SectionResource), then the source media itself.
 */
export const removeProjectResource = async ({
  memory,
  sourceMedia,
  mediafiles,
  sectionResources,
  resourceTypeId,
}: RemoveProjectResourceProps) => {
  // Without the derived-resource type we cannot tell our copies apart from
  // other media sharing `sourceMedia` (see removeUnselectedProjectResourceAssignments).
  if (!resourceTypeId) return;
  const records: Array<MediaFileD | SectionResourceD> = [];
  derivedResourceMedia(sourceMedia, mediafiles, resourceTypeId).forEach(
    (media) => {
      const sectionResource = sectionResources.find(
        (resource) => related(resource, 'mediafile') === media.id
      ) as SectionResourceD | undefined;
      if (sectionResource) records.push(sectionResource);
      records.push(media as MediaFileD);
    }
  );
  records.push(sourceMedia);
  await memory.update((transform) =>
    records.map((record) => transform.removeRecord(record))
  );
};
