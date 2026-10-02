import type { MediaFileD, PassageD, SectionD } from '../model';
import related from '../crud/related';
import { VernacularTag } from '../crud/useArtifactType';
import { passageTypeFromRef } from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageType';

export interface MissingTranscriptionPreflightInput {
  sections: SectionD[];
  passages: PassageD[];
  mediafiles: MediaFileD[];
  versions: number;
  maxRefs?: number;
}

/**
 * Returns up to `maxRefs` passage references where the *exported* vernacular audio
 * would have blank transcriptions. Mirrors `useBurritoAudio` vernacular selection:
 * - media is filtered to vernacular (artifactType missing/null)
 * - media is sorted by versionNumber descending
 * - only the first `versions` media per passage are considered
 */
export function firstMissingTranscriptionRefsForVernacularAudio({
  sections,
  passages,
  mediafiles,
  versions,
  maxRefs = 10,
}: MissingTranscriptionPreflightInput): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const section of sections) {
    const planId = related(section, 'plan') as string | null;
    if (!planId) continue;

    const planMedia = mediafiles.filter((m) => related(m, 'plan') === planId);
    const passageRecs = passages
      .filter((p) => related(p, 'section') === section.id)
      .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);

    for (const p of passageRecs) {
      if (
        passageTypeFromRef(p.attributes.reference, false) !==
        PassageTypeEnum.PASSAGE
      )
        continue;

      const media = planMedia.filter((m) => related(m, 'passage') === p.id);
      const vernMedia = media
        .filter(
          (m) =>
            related(m, 'artifactType') === VernacularTag ||
            !related(m, 'artifactType')
        )
        .sort(
          (a, b) => b.attributes.versionNumber - a.attributes.versionNumber
        );

      const take = Math.min(Math.max(versions, 0), vernMedia.length);
      if (take === 0) continue;

      const hasMissing = vernMedia
        .slice(0, take)
        .some((m) => !(m.attributes.transcription ?? '').trim());

      if (hasMissing) {
        const ref = p.attributes.reference;
        if (!seen.has(ref)) {
          out.push(ref);
          seen.add(ref);
          if (out.length >= maxRefs) return out;
        }
      }
    }
  }

  return out;
}
