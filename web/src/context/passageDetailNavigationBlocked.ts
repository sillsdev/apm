/** True when workflow/passage navigation must be blocked (active mic capture). */
export function isPassageNavigationBlocked(
  recording: boolean,
  commentRecording: boolean
): boolean {
  return recording || commentRecording;
}
