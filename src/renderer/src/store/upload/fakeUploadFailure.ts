/**
 * TEMPORARY manual-test harness for TT-7583 — DELETE BEFORE MERGING.
 *
 * Forces upload failures so the "possible network issue" retry banner can be
 * checked against each UploadFailureReason without arranging a real fault.
 *
 * Drive it from the browser console (no reload needed — it is read per attempt):
 *
 *   localStorage.apmFakeUpload = 'put:0'     // PUT never reaches S3  -> NoResponse  (WARNS)
 *   localStorage.apmFakeUpload = 'put:408'   // PUT times out         -> Timeout     (WARNS)
 *   localStorage.apmFakeUpload = 'put:403'   // S3 refuses the PUT    -> Rejected    (silent)
 *   localStorage.apmFakeUpload = 'put:500'   // S3 blows up           -> ServerError (silent)
 *   localStorage.apmFakeUpload = 'post:0'    // POST gets no response -> NoResponse  (WARNS)
 *   localStorage.apmFakeUpload = 'post:403'  // API refuses the POST  -> Rejected    (silent)
 *   localStorage.apmFakeUpload = 'post:500'  // API blows up          -> ServerError (silent)
 *
 *   delete localStorage.apmFakeUpload        // back to normal
 *
 * "WARNS" = setOrbitRetries fires, so Sources.tsx shows the retry banner.
 */
export type FakeUploadStage = 'put' | 'post';

const KEY = 'apmFakeUpload';

/**
 * The status this stage should pretend to fail with, or undefined to behave
 * normally. 0 means "the request never got a response".
 */
export const fakeUploadFailureStatus = (
  stage: FakeUploadStage
): number | undefined => {
  try {
    const raw = window?.localStorage?.getItem(KEY);
    if (!raw) return undefined;
    const [wanted, status] = raw.split(':');
    if (wanted !== stage) return undefined;
    const num = Number(status ?? 0);
    const faked = Number.isFinite(num) ? num : 0;

    console.warn(
      `[apmFakeUpload] faking ${stage} failure with status ${faked}`
    );
    return faked;
  } catch {
    return undefined;
  }
};
