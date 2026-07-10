import {
  aeroTaskErrorParts,
  axiosErrorMessage,
  transcriptionPollError,
} from './aeroTaskError';
import { AxiosError } from 'axios';

describe('aeroTaskErrorParts', () => {
  const taskFailed = 'AI transcription failed';

  it('splits Aero task failed prefix from sqlalchemy detail', () => {
    const msg =
      'Aero task failed: <class \'sqlalchemy.exc.DBAPIError\'>(["connection was closed"])';
    expect(aeroTaskErrorParts(msg, taskFailed)).toEqual({
      summary: taskFailed,
      details:
        '<class \'sqlalchemy.exc.DBAPIError\'>(["connection was closed"])',
    });
  });

  it('returns the localized summary when it is not an Aero task failure', () => {
    expect(aeroTaskErrorParts('Network Error', taskFailed)).toEqual({
      summary: taskFailed,
      details: 'Network Error',
    });
  });
});

describe('transcriptionPollError', () => {
  it('detects Aero task failed in message field', () => {
    expect(
      transcriptionPollError({
        message: 'Aero task failed: backend exploded',
      })
    ).toBe('Aero task failed: backend exploded');
  });

  it('ignores pending poll bodies without transcription', () => {
    expect(transcriptionPollError({ status: 'pending' })).toBeUndefined();
    expect(transcriptionPollError({})).toBeUndefined();
  });
});

describe('axiosErrorMessage', () => {
  it('reads message from axios 500 response body', () => {
    const err = new AxiosError(
      'Request failed',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      {
        status: 500,
        data: { message: 'Aero task failed: db down' },
      } as never
    );
    expect(axiosErrorMessage(err)).toBe('Aero task failed: db down');
  });
});
