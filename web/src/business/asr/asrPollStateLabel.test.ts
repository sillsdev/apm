import { describe, expect, it } from '@jest/globals';
import { asrPollStateLabel } from './asrPollStateLabel';

const labels = {
  asrQueued: 'QUEUED',
  asrPending: 'PENDING',
  asrStarted: 'STARTED',
  asrSuccess: 'SUCCESS',
  asrFailure: 'FAILURE',
};

describe('asrPollStateLabel', () => {
  it('uses queued when there is no clip state yet', () => {
    expect(asrPollStateLabel(undefined, labels)).toBe('QUEUED');
    expect(asrPollStateLabel('', labels)).toBe('QUEUED');
  });

  it('maps known service states to localized labels', () => {
    expect(asrPollStateLabel('pending', labels)).toBe('PENDING');
    expect(asrPollStateLabel('STARTED', labels)).toBe('STARTED');
    expect(asrPollStateLabel('SUCCESS', labels)).toBe('SUCCESS');
    expect(asrPollStateLabel('FAILURE', labels)).toBe('FAILURE');
  });

  it('does not surface an unknown raw service token', () => {
    expect(asrPollStateLabel('RETRYING', labels)).toBe('PENDING');
  });
});
