/** Speaker for the current Careful Speech segment (TT-7440). */
export function resolveSegmentSpeaker(
  performedBy: string | null | undefined,
  speakerLocalKey: string
): string {
  if (performedBy) return performedBy;
  return localStorage.getItem(speakerLocalKey) ?? '';
}
