/// <reference types="jest" />
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  ResourceUploadContext,
  type IResourceUploadContext,
} from './ResourceUploadContext';
import { UploadType } from '../../UploadType';

// The recorder state the panel reads during render; each test sets it before
// rendering, standing in for useMediaRecord.
let recState = { needsSave: false, hasTake: false };

jest.mock('react-redux', () => ({
  useSelector: () => ({ next: 'Next', save: 'Save' }),
  shallowEqual: jest.fn(),
}));
jest.mock('../../../context/UnsavedContext', () => {
  const { createContext } = jest.requireActual('react');
  return {
    UnsavedContext: createContext({ state: { startSave: jest.fn() } }),
  };
});
jest.mock('../../../control', () => ({
  Button: (props: {
    id?: string;
    disabled?: boolean;
    onClick?: () => void;
    children?: React.ReactNode;
  }) => (
    <button id={props.id} disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));
jest.mock('../../../utils/getRefWidth', () => ({ getRefWidth: () => 600 }));
jest.mock('../../MediaUploadContent', () => () => null);
jest.mock('../../SpeakerName', () => () => null);
jest.mock('../../Busy', () => () => null);
jest.mock('./UploadRecordToggle', () => ({
  __esModule: true,
  AudioAddMode: { Upload: 'upload', Record: 'record' },
  default: (props: { onMode: (mode: string) => void }) => (
    <button data-testid="tab-record" onClick={() => props.onMode('record')}>
      record
    </button>
  ),
}));
jest.mock('../../useMediaRecord', () => ({
  useMediaRecord: () => recState,
}));
jest.mock('../../MediaRecord', () => ({
  MediaRecordView: () => null,
}));

// After the mocks it depends on (jest hoists jest.mock, but this reads in order).
import { ResourceRecordPanel } from './ResourceRecordPanel';

const openRecordTab = (onNext?: () => void) => {
  const ctx: IResourceUploadContext = {
    active: true,
    isAddingAudioResource: true,
    uploadType: UploadType.ProjectResource,
    artifactId: null,
    defaultFilename: 'file',
    // A preselected speaker grants rights on tab entry.
    speaker: 'Alice',
    cancelled: { current: false },
    deferred: onNext
      ? {
          onNext,
          controlsRef: {
            current: { handleAddOrSave: null, handleCancel: null },
          },
        }
      : undefined,
  };
  render(
    <ResourceUploadContext.Provider value={ctx}>
      <ResourceRecordPanel
        uploadMethod={undefined}
        finish={jest.fn().mockResolvedValue(undefined)}
      />
    </ResourceUploadContext.Provider>
  );
  act(() => {
    fireEvent.click(screen.getByTestId('tab-record'));
  });
};

const button = (): HTMLButtonElement => {
  const el = document.getElementById('rec-save');
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error('record button not rendered');
  }
  return el;
};

describe('ResourceRecordPanel record button', () => {
  it('enables Next (wizard) for a take that already uploaded', () => {
    // An uploaded take clears needsSave but is still in the waveform.
    recState = { needsSave: false, hasTake: true };
    openRecordTab(jest.fn());
    expect(button().disabled).toBe(false);
  });

  it('disables Next (wizard) when there is no usable take', () => {
    // e.g. the take was deleted, or a new recording is in progress.
    recState = { needsSave: false, hasTake: false };
    openRecordTab(jest.fn());
    expect(button().disabled).toBe(true);
  });

  it('gates Save (no wizard) on unsaved changes, not on a take being shown', () => {
    recState = { needsSave: false, hasTake: true };
    openRecordTab();
    expect(button().disabled).toBe(true);
  });

  it('enables Save (no wizard) when there are unsaved changes', () => {
    recState = { needsSave: true, hasTake: true };
    openRecordTab();
    expect(button().disabled).toBe(false);
  });
});
