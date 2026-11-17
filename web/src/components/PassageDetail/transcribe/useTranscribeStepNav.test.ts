import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { ActivityStates } from '../../../model';
import { ToolSlug } from '../../../crud/toolSlug';

jest.mock('../../../context/completeStepAfterSave', () => ({
  trySetStepComplete: jest.fn(),
}));

import { trySetStepComplete } from '../../../context/completeStepAfterSave';
import { useTranscribeStepNav } from './useTranscribeStepNav';

const trySet = trySetStepComplete as unknown as jest.MockedFunction<
  typeof trySetStepComplete
>;

describe('useTranscribeStepNav', () => {
  const setStepComplete = jest.fn(
    async (_id: string, _complete: boolean) => {}
  );
  const setCurrentStep = jest.fn();
  const parsedSteps = [
    { id: 'record', sequencenum: 0, tool: ToolSlug.Record, settings: '{}' },
    {
      id: 'transcribe',
      sequencenum: 1,
      tool: ToolSlug.Transcribe,
      settings: '{}',
    },
    {
      id: 'check',
      sequencenum: 2,
      tool: ToolSlug.Transcribe,
      settings: '{}',
    },
  ];

  beforeEach(() => {
    trySet.mockReset();
    trySet.mockImplementation(async () => true);
    setStepComplete.mockClear();
    setCurrentStep.mockClear();
  });

  it('handleReopen uncompletes current and checking next, then editor goes back', async () => {
    const { result } = renderHook(() =>
      useTranscribeStepNav({
        currentstep: 'check',
        parsedSteps,
        hasChecking: true,
        nextStep: null,
        prevStep: 'transcribe',
        curRole: 'editor',
        setStepComplete,
        setCurrentStep,
      })
    );

    await act(async () => {
      result.current.handleReopen();
      await Promise.resolve();
    });

    expect(trySet).toHaveBeenCalledWith(setStepComplete, 'check', false);
    expect(setCurrentStep).toHaveBeenCalledWith('transcribe');
  });

  it('handleReject NeedsNewRecording jumps to Record for vernacular', async () => {
    const { result } = renderHook(() =>
      useTranscribeStepNav({
        currentstep: 'transcribe',
        parsedSteps,
        hasChecking: false,
        nextStep: null,
        prevStep: 'record',
        curRole: 'transcriber',
        setStepComplete,
        setCurrentStep,
      })
    );

    await act(async () => {
      await result.current.handleReject(ActivityStates.NeedsNewRecording);
    });

    expect(trySet).toHaveBeenCalledWith(setStepComplete, 'record', false);
    expect(setCurrentStep).toHaveBeenCalledWith('record');
  });
});
