/**
 * TT-6952 — "NetworkError - will try again soon" after deleting a Team/Project.
 *
 * The transform that fails in production is the 2-operation
 * `removeRecord plan` + `removeRecord project` pushed by useProjectDelete.
 * When the server rejects it at the fetch layer, updateError must give up
 * after a bounded number of attempts and `skip()` the task, because
 * JSONAPISource shares ONE requestQueue between queries and updates: a failed
 * task left at the head of the queue is re-attempted ahead of every later
 * request, so opening another project can never run its `remote.query`.
 */
jest.mock('./handleUnauthorized', () => ({
  handleUnauthorized: jest.fn(),
}));
// logErrorService imports the utils barrel, which drags in the redux store and
// react-localization (ESM) and fails to parse under ts-jest. Mirror the real
// Severity values so orbitRetry's response.status still means what it means.
jest.mock('./logErrorService', () => ({
  __esModule: true,
  default: jest.fn(),
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));

import type { RecordOperation, RecordTransform } from '@orbit/records';
import { updateError } from './orbitStrategyErrors';
import { OrbitNetworkErrorRetries } from '../../api-variable';
import { Severity } from './logErrorService';
import type { IApiError } from '../model';
import { holdRemoteQueue } from './itfQueue';

const deleteOps = (): RecordOperation[] => [
  { op: 'removeRecord', record: { type: 'plan', id: 'p1' } },
  { op: 'removeRecord', record: { type: 'project', id: 'j1' } },
];

const makeTransform = (id: string): RecordTransform =>
  ({ id, operations: deleteOps() }) as unknown as RecordTransform;

const setup = () => {
  const retry = jest.fn().mockResolvedValue(undefined);
  const skip = jest.fn().mockResolvedValue(undefined);
  const remote = { requestQueue: { retry, skip } };
  const coordinator = {
    getSource: jest.fn(() => remote),
  } as unknown as Parameters<typeof updateError>[0]['coordinator'];
  const memory = {
    transformLog: { contains: jest.fn(() => true) },
    rollback: jest.fn(),
  } as unknown as Parameters<typeof updateError>[0]['memory'];
  const orbitError = jest.fn();
  const setOrbitRetries = jest.fn();
  const showMessage = jest.fn();

  const handler = updateError({
    tokenCtx: {
      state: { accessToken: 'tok' },
    } as unknown as Parameters<typeof updateError>[0]['tokenCtx'],
    orbitError,
    setOrbitRetries,
    showMessage,
    memory,
    coordinator,
    fingerprint: 'fp',
    errorReporter: undefined,
  });

  /** Drive the production loop: each scheduled retry() fails again. */
  const failTimes = (transform: RecordTransform, times: number) => {
    for (let i = 0; i < times; i += 1) {
      handler(transform, new Error('Failed to fetch'));
      jest.runOnlyPendingTimers();
    }
  };

  const retryToasts = () =>
    orbitError.mock.calls.filter(
      (c) => (c[0] as IApiError)?.response?.status === Severity.retry
    );

  return {
    handler,
    retry,
    skip,
    memory,
    orbitError,
    showMessage,
    retryToasts,
    failTimes,
  };
};

describe('updateError — network failure on a delete transform', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('stops retrying after OrbitNetworkErrorRetries attempts', () => {
    const { retry, failTimes } = setup();

    failTimes(makeTransform('tx-delete'), OrbitNetworkErrorRetries * 3);

    expect(retry.mock.calls.length).toBeLessThanOrEqual(
      OrbitNetworkErrorRetries
    );
  });

  it('skips the poisoned task so later queries can run', () => {
    const { skip, failTimes } = setup();

    failTimes(makeTransform('tx-delete'), OrbitNetworkErrorRetries * 3);

    expect(skip).toHaveBeenCalledTimes(1);
  });

  it('shows the retry message once, not once per attempt', () => {
    const { retryToasts, failTimes } = setup();

    failTimes(makeTransform('tx-delete'), OrbitNetworkErrorRetries * 3);

    expect(retryToasts()).toHaveLength(1);
  });

  it('rolls memory back and reports a real error once it gives up', () => {
    const { memory, orbitError, failTimes } = setup();

    failTimes(makeTransform('tx-delete'), OrbitNetworkErrorRetries * 3);

    expect(memory.rollback).toHaveBeenCalledWith('tx-delete', -1);
    const finalErrors = orbitError.mock.calls.filter(
      (c) => (c[0] as IApiError)?.response?.status !== Severity.retry
    );
    expect(finalErrors).toHaveLength(1);
  });

  // Discriminator: the fix must bound retries PER TRANSFORM, not disable
  // retrying altogether. A fresh transform still gets its own budget.
  it('gives an unrelated later transform its own retry budget', () => {
    const { retry, failTimes } = setup();

    failTimes(makeTransform('tx-delete'), OrbitNetworkErrorRetries * 3);
    const afterFirst = retry.mock.calls.length;

    failTimes(makeTransform('tx-other'), 1);

    expect(retry.mock.calls.length).toBe(afterFirst + 1);
  });
});

describe('updateError — non-network failures are unchanged', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('skips and rolls back immediately on a server error', () => {
    const { skip, memory, orbitError, handler } = setup();

    handler(makeTransform('tx-500'), {
      response: { status: 500, url: 'https://api/plans/9' },
    });

    expect(skip).toHaveBeenCalledTimes(1);
    expect(memory.rollback).toHaveBeenCalledWith('tx-500', -1);
    expect(orbitError).toHaveBeenCalledTimes(1);
  });

  it('reports "Entity has been deleted" through showMessage', () => {
    const { showMessage, handler } = setup();

    handler(makeTransform('tx-gone'), {
      data: {
        errors: [{ meta: { stackTrace: ['Entity has been deleted already'] } }],
      },
    });

    expect(showMessage).toHaveBeenCalledWith('Entity has been deleted already');
  });
});

/**
 * Web offline: Orbit edits made while the browser is offline (including
 * DevTools "Offline") are held at the head of the remote queue, not undone.
 * useCheckOnline's offline→online edge calls orbitReset → queue.retry(), which
 * sends them in order.
 */
describe('updateError — held while the browser is offline', () => {
  let onLine: jest.SpyInstance<boolean, []>;
  beforeEach(() => {
    jest.useFakeTimers();
    onLine = jest
      .spyOn(window.navigator, 'onLine', 'get')
      .mockReturnValue(false);
  });
  afterEach(() => {
    onLine.mockRestore();
    jest.useRealTimers();
  });

  it('never rolls back, skips, or raises a fatal error while offline', () => {
    const { skip, memory, orbitError, failTimes } = setup();

    failTimes(makeTransform('tx-offline'), OrbitNetworkErrorRetries * 3);

    expect(skip).not.toHaveBeenCalled();
    expect(memory.rollback).not.toHaveBeenCalled();
    const fatal = orbitError.mock.calls.filter(
      (c) => (c[0] as IApiError)?.response?.status !== Severity.retry
    );
    expect(fatal).toHaveLength(0);
  });

  it('does not schedule retries while offline (the online edge resumes)', () => {
    const { retry, failTimes } = setup();

    failTimes(makeTransform('tx-offline'), 3);

    expect(retry).not.toHaveBeenCalled();
  });

  it('tells the user once that changes are waiting', () => {
    const { retryToasts, failTimes } = setup();

    failTimes(makeTransform('tx-offline'), 4);

    expect(retryToasts()).toHaveLength(1);
  });

  it('gives the full retry budget once back online', () => {
    const { retry, skip, handler, failTimes } = setup();
    const tx = makeTransform('tx-offline');

    failTimes(tx, OrbitNetworkErrorRetries * 2);
    onLine.mockReturnValue(true);
    // Fails once online (flaky link): normal bounded retry resumes.
    handler(tx, new Error('Failed to fetch'));
    jest.runOnlyPendingTimers();

    expect(retry).toHaveBeenCalledTimes(1);
    expect(skip).not.toHaveBeenCalled();
  });
});

/**
 * TT-7911: a retry timer started before the connection came back must not
 * replay the queue while a reconnect ITF holds it; the ITF settles the queue.
 */
describe('updateError — held by a reconnect ITF', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not fire a pending retry while the queue is held', () => {
    const { retry, handler } = setup();

    handler(makeTransform('tx-itf'), new Error('Failed to fetch'));
    const release = holdRemoteQueue(undefined);
    try {
      jest.runOnlyPendingTimers();
      expect(retry).not.toHaveBeenCalled();
    } finally {
      release();
    }
  });

  it('waits instead of giving up while held (no skip, rollback or retry)', () => {
    const { retry, skip, memory, orbitError, failTimes } = setup();
    const release = holdRemoteQueue(undefined);
    try {
      failTimes(makeTransform('tx-held'), OrbitNetworkErrorRetries * 3);
    } finally {
      release();
    }

    expect(retry).not.toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
    expect(memory.rollback).not.toHaveBeenCalled();
    const fatal = orbitError.mock.calls.filter(
      (c) => (c[0] as IApiError)?.response?.status !== Severity.retry
    );
    expect(fatal).toHaveLength(0);
  });

  it('attempts before and during a hold do not count toward giving up', () => {
    const { retry, skip, handler, failTimes } = setup();
    const tx = makeTransform('tx-held');
    failTimes(tx, OrbitNetworkErrorRetries - 1);
    // The last allowed attempt's timer is pending when the disconnect holds.
    handler(tx, new Error('Failed to fetch'));
    const release = holdRemoteQueue(undefined);
    jest.runOnlyPendingTimers();
    release();
    retry.mockClear();

    // The release replays the queue; a flaky link gets the full budget again.
    failTimes(tx, OrbitNetworkErrorRetries);

    expect(skip).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledTimes(OrbitNetworkErrorRetries);
  });

  it('a retry timer from before a hold does not fire after its release', () => {
    const { retry, handler } = setup();

    handler(makeTransform('tx-held'), new Error('Failed to fetch'));
    const release = holdRemoteQueue(undefined);
    release();
    // The release's own replay sends the queue; a second retry() could
    // resend an in-flight request.
    jest.runOnlyPendingTimers();

    expect(retry).not.toHaveBeenCalled();
  });
});
