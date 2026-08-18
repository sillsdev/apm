import type { SharedResourceD } from '../model/sharedResource';

function sourcePassageId(
  sharedResource: SharedResourceD | undefined | null
): string | undefined {
  const data = sharedResource?.relationships?.passage?.data as
    | { id?: string }
    | unknown[]
    | null
    | undefined;
  if (!data || Array.isArray(data)) return undefined;
  return data.id;
}

/** True when this passage points at a SharedResource owned by a different passage. */
export function isLinkedNote(
  passage: { id?: string } | undefined | null,
  sharedResource: SharedResourceD | undefined | null
): boolean {
  const sourceId = sourcePassageId(sharedResource);
  return Boolean(passage?.id && sourceId && sourceId !== passage.id);
}
