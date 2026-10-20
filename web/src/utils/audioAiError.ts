export enum AudioAiErrorCode {
  offline = 'offline',
  noToken = 'noToken',
  canceled = 'canceled',
}

/** `code` is how callers tell these apart. `message` is not user-facing text. */
export class AudioAiError extends Error {
  readonly code: AudioAiErrorCode;

  constructor(code: AudioAiErrorCode) {
    super('AudioAiError');
    this.name = 'AudioAiError';
    this.code = code;
  }
}

/** The result didn't arrive within the poll limit. Kept as its own class so
 * callers can record the time taken (TT-6276) while still reporting it as a
 * failure; the message stays the one users and Bugsnag already see. */
export class AudioAiTimeoutError extends Error {
  constructor() {
    super('AI result timed out');
    this.name = 'AudioAiTimeoutError';
  }
}
