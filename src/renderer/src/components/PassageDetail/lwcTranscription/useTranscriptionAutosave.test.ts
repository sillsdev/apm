import '@testing-library/jest-dom';
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useTranscriptionAutosave } from './useTranscriptionAutosave';
import { MediaFileD } from '../../../model';

jest.mock('../../../context/UnsavedContext', () => ({
  UnsavedContext: React.createContext({
    state: {
      toolChanged: jest.fn(),
      saveCompleted: jest.fn(),
      startSave: jest.fn(),
    },
  }),
}));

jest.mock('../../../crud/saveMediaTranscription', () => ({
  saveMediaTranscription: jest.fn().mockResolvedValue(undefined),
}));

import { saveMediaTranscription } from '../../../crud/saveMediaTranscription';

const mockSave = saveMediaTranscription as jest.Mock;

const memory = {} as never;
const user = 'user1';

function media(id: string, transcription?: string): MediaFileD {
  return {
    id,
    type: 'mediafile',
    attributes: { transcription },
  } as MediaFileD;
}

describe('useTranscriptionAutosave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSave.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not save programmatic empty text over existing transcription', async () => {
    const userEditedRef = { current: false };
    const mf = media('mf1', 'saved text');

    const { rerender } = renderHook(
      ({ text }) =>
        useTranscriptionAutosave({
          toolId: 'CarefulTranscriptionTool',
          mediafile: mf,
          text,
          memory,
          user,
          userEditedRef,
        }),
      { initialProps: { text: 'saved text' } }
    );

    rerender({ text: '' });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('saves when the user clears transcription text', async () => {
    const userEditedRef = { current: false };
    const mf = media('mf1', 'saved text');

    const { rerender } = renderHook(
      ({ text }) =>
        useTranscriptionAutosave({
          toolId: 'CarefulTranscriptionTool',
          mediafile: mf,
          text,
          memory,
          user,
          userEditedRef,
        }),
      { initialProps: { text: 'saved text' } }
    );

    userEditedRef.current = true;
    rerender({ text: '' });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(mockSave).toHaveBeenCalledWith(memory, mf, '', user);
  });
});
