import {
  UPLOAD_PENDING_DRAIN_MESSAGE,
  UPLOAD_PENDING_SYNC_TAG,
  isUploadPendingDrainMessage,
  requestUploadPendingBackgroundSync,
} from './uploadPendingBackgroundSync';

const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator'
);

const setNavigator = (value: unknown) =>
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  });

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  }
});

describe('isUploadPendingDrainMessage', () => {
  it('accepts only the drain message shape', () => {
    expect(
      isUploadPendingDrainMessage({ type: UPLOAD_PENDING_DRAIN_MESSAGE })
    ).toBe(true);
    expect(isUploadPendingDrainMessage({ type: 'other' })).toBe(false);
    expect(isUploadPendingDrainMessage(null)).toBe(false);
    expect(isUploadPendingDrainMessage('UPLOAD_PENDING_DRAIN')).toBe(false);
  });
});

describe('requestUploadPendingBackgroundSync', () => {
  it('registers the sync tag when SyncManager is supported', async () => {
    const register = jest.fn(async () => undefined);
    setNavigator({
      serviceWorker: { ready: Promise.resolve({ sync: { register } }) },
    });

    await requestUploadPendingBackgroundSync();

    expect(register).toHaveBeenCalledWith(UPLOAD_PENDING_SYNC_TAG);
  });

  it('does nothing when the registration has no SyncManager', async () => {
    setNavigator({ serviceWorker: { ready: Promise.resolve({}) } });

    await expect(requestUploadPendingBackgroundSync()).resolves.toBeUndefined();
  });

  it('does nothing without service workers', async () => {
    setNavigator({});

    await expect(requestUploadPendingBackgroundSync()).resolves.toBeUndefined();
  });

  it('swallows a failed registration', async () => {
    const register = jest.fn(async () => {
      throw new Error('denied');
    });
    setNavigator({
      serviceWorker: { ready: Promise.resolve({ sync: { register } }) },
    });

    await expect(requestUploadPendingBackgroundSync()).resolves.toBeUndefined();
  });
});
