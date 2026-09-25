import { ArtifactType, MediaFileD } from '../../../model';
import { related } from '../../../crud';
import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';

/** Ids of the `projectresource` artifact type (offline and remote copies). */
export const projectResourceTypeIds = (artifactTypes: ArtifactType[]) =>
  artifactTypes
    .filter((t) => t.attributes?.typename === ArtifactTypeSlug.ProjectResource)
    .map((t) => t.id);

/**
 * Resolve a row's media to the root general (project) resource, or undefined
 * when the media is not part of a general resource.
 *
 * When a derived copy is given, its source is returned; only when the media is
 * itself the general resource does it fall back to that media. Derived copies
 * use the `resource` type (not `projectresource`), so in practice only one
 * branch matches, but preferring the source guards against ever treating a
 * derived copy as a new source (which would spawn a second-generation chain).
 *
 * This is the same resolution the Edit (pencil) action uses to decide whether
 * to reopen the general-resource wizard, so the "General" type label and badge
 * always agree with what Edit does.
 */
export const generalResourceMedia = (
  media: MediaFileD | undefined,
  mediafiles: MediaFileD[],
  projResourceTypeIds: (string | undefined)[]
): MediaFileD | undefined => {
  const isProjectType = (m: MediaFileD | undefined) =>
    Boolean(m) && projResourceTypeIds.includes(related(m, 'artifactType'));
  const sourceMedia = mediafiles.find(
    (m) => m.id === related(media, 'sourceMedia')
  );
  return isProjectType(sourceMedia)
    ? sourceMedia
    : isProjectType(media)
      ? media
      : undefined;
};
