/// <reference types="jest" />
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ResourceRecordPanel } from './ResourceRecordPanel';
import {
  ResourceUploadContext,
  type IResourceUploadContext,
} from './ResourceUploadContext';
import { UploadType } from '../../UploadType';

type MediaRecordProps = {
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  setCanSave: (canSave: boolean) => void;
  onRecording?: (isRecording: boolean) => void;
};

let recorder: MediaRecordProps | undefined;

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
jest.mock('../../MediaRecord', () => ({
  __esModule: true,
  default: (props: MediaRecordProps) => {
    recorder = props;
    return null;
  },
}));

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
      ? { onNext, controlsRef: { current: {} } as never }
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

const button = () => document.getElementById('rec-save') as HTMLButtonElement;

describe('ResourceRecordPanel record button', () => {
  beforeEach(() => {
    recorder = undefined;
  });

  it('keeps Next enabled after Back to a take that already uploaded', async () => {
    openRecordTab(jest.fn());
    act(() => recorder!.setCanSave(true));
    expect(button().disabled).toBe(false);

    // SelectSections uploads the take; the upload clears canSave but the take
    // stays in the waveform, so a Back to this step must still allow Next.
    await act(async () => {
      await recorder!.afterUploadCb('media-1');
      recorder!.setCanSave(false);
    });
    expect(button().disabled).toBe(false);
  });

  it('disables Next once a new recording starts over the uploaded take', async () => {
    openRecordTab(jest.fn());
    await act(async () => {
      await recorder!.afterUploadCb('media-1');
      recorder!.setCanSave(false);
    });
    act(() => recorder!.onRecording?.(true));
    expect(button().disabled).toBe(true);
  });

  it('does not count a failed upload as an uploaded take', async () => {
    openRecordTab(jest.fn());
    await act(async () => {
      await recorder!.afterUploadCb(undefined);
      recorder!.setCanSave(false);
    });
    expect(button().disabled).toBe(true);
  });

  it('gates Save (no wizard) on unsaved changes only', async () => {
    openRecordTab();
    await act(async () => {
      await recorder!.afterUploadCb('media-1');
      recorder!.setCanSave(false);
    });
    expect(button().disabled).toBe(true);
  });
});
