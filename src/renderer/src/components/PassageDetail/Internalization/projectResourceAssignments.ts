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
