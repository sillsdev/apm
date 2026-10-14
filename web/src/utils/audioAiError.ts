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
