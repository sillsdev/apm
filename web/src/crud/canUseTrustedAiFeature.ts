/** TT-6250: Recognize Speech and Convert Voice stay available only to shared-content creators while online. */
export function canUseTrustedAiFeature(
  featureEnabled: boolean | null | undefined,
  offline: boolean,
  userIsSharedContentCreator: boolean | null | undefined
): boolean {
  return (
    Boolean(featureEnabled) && !offline && Boolean(userIsSharedContentCreator)
  );
}
