import React from 'react';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';
import { cleanup, fireEvent, render } from '@testing-library/react';

jest.mock('../context/HotKeyContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HotKeyContext: React.createContext({
      state: {
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        localizeHotKey: (key: string) => key,
      },
      setState: jest.fn(),
    }),
  };
});

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => ({
    autoSegment: 'Auto Segment [{0}]',
    segmentSettings: 'Segment Settings',
    segmentsCreated: '{0} segments created',
    splitSegment: 'Add Boundary [Double Click/{0}]',
    removeSegment: 'Remove Boundary [{0}]',
  })),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn(() => [false]),
}));

jest.mock('../utils/useMobile', () => ({
  useMobile: () => ({ isMobileView: false }),
}));

jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('./WSSegmentParameters', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../control/LightTooltip', () => ({
  LightTooltip: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../control/GrowingDiv', () => ({
  GrowingDiv: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../control/ToolbarGrid', () => ({
  ToolbarGrid: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import WSAudioPlayerSegment from './WSAudioPlayerSegment';
import type { IRegionChange } from '../crud/useWavesurferRegions';

const splitResult: IRegionChange = {
  start: 1,
  end: 2,
  newStart: 1.5,
  newEnd: 2,
};

describe('WSAudioPlayerSegment — Add Boundary gesture', () => {
  const wsAddRegion = jest.fn<() => IRegionChange | undefined>(
    () => splitResult
  );
  const wsRemoveSplitRegion = jest.fn<() => IRegionChange | undefined>(
    () => undefined
  );
  const onSplit = jest.fn<(split: IRegionChange) => void>();

  beforeEach(() => {
    wsAddRegion.mockClear();
    wsRemoveSplitRegion.mockClear();
    onSplit.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  const renderSegment = () =>
    render(
      <WSAudioPlayerSegment
        ready
        loop={false}
        currentNumRegions={1}
        playing={false}
        onSplit={onSplit}
        wsRemoveSplitRegion={wsRemoveSplitRegion}
        wsAddRegion={wsAddRegion}
      />
    );

  it('does not create a boundary on a single click of Add Boundary', () => {
    renderSegment();
    // id is the stable hook for this icon-only button.
    fireEvent.click(document.getElementById('wsSplit')!);
    expect(wsAddRegion).not.toHaveBeenCalled();
    expect(onSplit).not.toHaveBeenCalled();
  });

  it('creates a boundary on double-click of Add Boundary', () => {
    renderSegment();
    fireEvent.doubleClick(document.getElementById('wsSplit')!);
    expect(wsAddRegion).toHaveBeenCalledTimes(1);
    expect(onSplit).toHaveBeenCalledWith(splitResult);
  });
});
