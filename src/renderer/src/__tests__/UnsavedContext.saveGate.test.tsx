jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({
    showMessage: jest.fn(),
    showAlert: jest.fn(),
  }),
}));

jest.mock('../components/AlertDialog', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => ({
    UnsavedData: 'Unsaved',
    saveFirst: 'Save first',
    saving: 'Saving...',
    loadingTable: 'Loading table',
  })),
}));

import React from 'react';
import { render, act } from '@testing-library/react';
import { GlobalProvider, GlobalState } from '../context/GlobalContext';
import { UnsavedProvider, UnsavedContext } from '../context/UnsavedContext';

function SaveGateProbe() {
  const { state } = React.useContext(UnsavedContext);
  return (
    <button
      type="button"
      id="testNavigateHome"
      onClick={() => state.checkSavedFn(() => {
        (window as unknown as { __navCalled?: boolean }).__navCalled = true;
      })}
    >
      Home
    </button>
  );
}

function setup(initial: Partial<GlobalState> = {}) {
  const globals = {
    plan: 'plan-1',
    user: 'u1',
    offlineOnly: false,
    remoteBusy: true,
    changed: true,
    importexportBusy: false,
    alertOpen: false,
    progress: 0,
    ...initial,
  } as GlobalState;

  let ctxState: typeof UnsavedContext extends React.Context<infer V>
    ? V extends { state: infer S }
      ? S
      : never
    : never;

  const Capture = () => {
    ctxState = React.useContext(UnsavedContext).state;
    return null;
  };

  render(
    <GlobalProvider init={globals}>
      <UnsavedProvider>
        <Capture />
        <SaveGateProbe />
      </UnsavedProvider>
    </GlobalProvider>
  );

  return {
    getState: () => ctxState,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  (window as unknown as { __navCalled?: boolean }).__navCalled = false;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('TT-6919 save gate prevention', () => {
  it('does not navigate while remoteBusy and save are in progress', async () => {
    const { getState } = setup({ remoteBusy: true, changed: true });
    getState().toolChanged('scriptureTable', true);
    getState().startSave('scriptureTable');

    document.getElementById('testNavigateHome')?.click();

    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect((window as unknown as { __navCalled?: boolean }).__navCalled).toBe(
      false
    );
  });

  it('navigates after save completes and remoteBusy clears', async () => {
    const { getState } = setup({ remoteBusy: true, changed: true });
    getState().toolChanged('scriptureTable', true);
    getState().startSave('scriptureTable');

    document.getElementById('testNavigateHome')?.click();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    getState().saveCompleted('scriptureTable');

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect((window as unknown as { __navCalled?: boolean }).__navCalled).toBe(
      true
    );
  });

  it('waits through slow save before navigation (slowDataChanges)', async () => {
    const { getState } = setup({ remoteBusy: true, changed: false });
    getState().startSave('scriptureTable');

    document.getElementById('testNavigateHome')?.click();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect((window as unknown as { __navCalled?: boolean }).__navCalled).toBe(
      false
    );

    getState().saveCompleted('scriptureTable');

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect((window as unknown as { __navCalled?: boolean }).__navCalled).toBe(
      true
    );
  });
});
