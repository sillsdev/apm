import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { ActivityStates, MediaFileD, PassageD, SectionD } from '../../../model';

jest.mock('../../../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { error: 0 },
}));

import { useTranscribeActions } from './useTranscribeActions';

describe('useTranscribeActions', () => {
  let mockMemory: any;
  let mockPassage: PassageD;
  let mockSection: SectionD;
  let mockMediafile: MediaFileD;
  let mockSetComplete: jest.Mock;
  let mockOnReject: jest.Mock;
  let mockOnReopen: jest.Mock;
  let mockOnReloadPlayer: jest.Mock;
  let mockSetPosition: jest.Mock;
  let mockSaveCompleted: jest.Mock;

  const getSavedTranscriptionState = (memoryUpdateMock: jest.Mock) => {
    const ops = memoryUpdateMock.mock.calls[0][0] as any[];
    const stateOp = ops.find(
      (op: any) =>
        op.op === 'updateRecord' &&
        op.record?.type === 'mediafile' &&
        op.record?.attributes?.transcriptionstate !== undefined
    );
    return stateOp?.record?.attributes?.transcriptionstate;
  };

  beforeEach(() => {
    mockMemory = {
      schema: {
        models: {},
        generateId: () => 'id-123',
      },
      update: jest.fn().mockResolvedValue(undefined as unknown as never),
      cache: {
        query: jest.fn(),
      },
    };
    mockPassage = {
      type: 'passage',
      id: 'p1',
      attributes: {
        reference: 'GEN 1:1',
      },
    } as unknown as PassageD;
    mockSection = {
      type: 'section',
      id: 's1',
      attributes: {
        sequencenum: 1,
      },
      relationships: {},
    } as unknown as SectionD;
    mockMediafile = {
      type: 'mediafile',
      id: 'm1',
      attributes: {
        transcription: 'Initial text',
        transcriptionstate: ActivityStates.Transcribing,
        position: 5,
        segments: '{"regions":[]}',
      },
    } as unknown as MediaFileD;
    mockSetComplete = jest.fn();
    mockOnReject = jest.fn();
    mockOnReopen = jest.fn();
    mockOnReloadPlayer = jest.fn();
    mockSetPosition = jest.fn();
    mockSaveCompleted = jest.fn();
  });

  it('correctly reports transcribing state', () => {
    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        getTranscriptionText: () => 'Initial text',
      })
    );

    expect(result.current.transcribing).toBe(true);
    expect(result.current.reviewing).toBe(false);
    expect(result.current.state).toBe(ActivityStates.Transcribing);
  });

  it('correctly reports reviewing state', () => {
    const reviewingMedia = {
      ...mockMediafile,
      attributes: {
        ...mockMediafile.attributes,
        transcriptionstate: ActivityStates.Reviewing,
      },
    };

    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: reviewingMedia,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        getTranscriptionText: () => 'Initial text',
      })
    );

    expect(result.current.transcribing).toBe(false);
    expect(result.current.reviewing).toBe(true);
    expect(result.current.state).toBe(ActivityStates.Reviewing);
  });

  it('handleSave updates memory with transcription and position', async () => {
    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        getTranscriptionText: () => 'Updated transcription text',
        getPosition: () => 12.5,
        getSegments: () => '{"regions":[{"start":0,"end":5}]}',
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSaveCompleted).toHaveBeenCalledWith('step1');
  });

  it('handleSubmit advances transcription state and marks step complete', async () => {
    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        hasChecking: true,
        noParatext: false,
        getTranscriptionText: () => 'Completed text',
        setComplete: mockSetComplete,
        onReloadPlayer: mockOnReloadPlayer,
        setPosition: mockSetPosition,
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSetPosition).toHaveBeenCalledWith(0);
    expect(mockSetComplete).toHaveBeenCalledWith(true);
    expect(mockOnReloadPlayer).toHaveBeenCalledWith(mockMediafile);
    expect(getSavedTranscriptionState(mockMemory.update)).toBe(
      ActivityStates.Transcribed
    );
  });

  it('handleSubmit advances reviewing state to approved when noParatext is false (Scripture)', async () => {
    const reviewingMedia = {
      ...mockMediafile,
      attributes: {
        ...mockMediafile.attributes,
        transcriptionstate: ActivityStates.Reviewing,
      },
    };

    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: reviewingMedia,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        hasChecking: true,
        noParatext: false,
        getTranscriptionText: () => 'Reviewed text',
        setComplete: mockSetComplete,
        onReloadPlayer: mockOnReloadPlayer,
        setPosition: mockSetPosition,
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSetComplete).toHaveBeenCalledWith(true);
    expect(getSavedTranscriptionState(mockMemory.update)).toBe(
      ActivityStates.Approved
    );
  });

  it('handleSubmit advances transcribing state to approved when hasChecking is false and noParatext is false', async () => {
    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        hasChecking: false,
        noParatext: false,
        getTranscriptionText: () => 'Completed text',
        setComplete: mockSetComplete,
        onReloadPlayer: mockOnReloadPlayer,
        setPosition: mockSetPosition,
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSetComplete).toHaveBeenCalledWith(true);
    expect(getSavedTranscriptionState(mockMemory.update)).toBe(
      ActivityStates.Approved
    );
  });

  it('handleSubmit advances reviewing state to done when noParatext is true (non-Scripture or Retell/Q&A)', async () => {
    const reviewingMedia = {
      ...mockMediafile,
      attributes: {
        ...mockMediafile.attributes,
        transcriptionstate: ActivityStates.Reviewing,
      },
    };

    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: reviewingMedia,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        hasChecking: true,
        noParatext: true,
        getTranscriptionText: () => 'Reviewed text',
        setComplete: mockSetComplete,
        onReloadPlayer: mockOnReloadPlayer,
        setPosition: mockSetPosition,
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSetComplete).toHaveBeenCalledWith(true);
    expect(getSavedTranscriptionState(mockMemory.update)).toBe(
      ActivityStates.Done
    );
  });

  it('handleSubmit advances transcribed state to done when noParatext is true', async () => {
    const transcribedMedia = {
      ...mockMediafile,
      attributes: {
        ...mockMediafile.attributes,
        transcriptionstate: ActivityStates.Transcribed,
      },
    };

    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: transcribedMedia,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        hasChecking: true,
        noParatext: true,
        getTranscriptionText: () => 'Reviewed text',
        setComplete: mockSetComplete,
        onReloadPlayer: mockOnReloadPlayer,
        setPosition: mockSetPosition,
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSetComplete).toHaveBeenCalledWith(true);
    expect(getSavedTranscriptionState(mockMemory.update)).toBe(
      ActivityStates.Done
    );
  });

  it('handleSubmit advances transcribing state directly to done when hasChecking is false and noParatext is true', async () => {
    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        hasChecking: false,
        noParatext: true,
        getTranscriptionText: () => 'Completed text',
        setComplete: mockSetComplete,
        onReloadPlayer: mockOnReloadPlayer,
        setPosition: mockSetPosition,
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSetComplete).toHaveBeenCalledWith(true);
    expect(getSavedTranscriptionState(mockMemory.update)).toBe(
      ActivityStates.Done
    );
  });

  it('handleReject opens reject dialog and handleRejected updates state with comment', async () => {
    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        getTranscriptionText: () => 'Text',
        onReject: mockOnReject,
      })
    );

    act(() => {
      result.current.handleReject();
    });
    expect(result.current.rejectVisible).toBe(true);

    const rejectedMedia = {
      ...mockMediafile,
      attributes: {
        ...mockMediafile.attributes,
        transcriptionstate: ActivityStates.NeedsNewRecording,
      },
    };

    await act(async () => {
      await result.current.handleRejected(rejectedMedia, 'Audio unclear');
    });

    expect(result.current.rejectVisible).toBe(false);
    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockOnReject).toHaveBeenCalledWith(ActivityStates.NeedsNewRecording);
  });

  it('handleReopen resets state to transcribeReady and marks incomplete', async () => {
    const transcribedMedia = {
      ...mockMediafile,
      attributes: {
        ...mockMediafile.attributes,
        transcriptionstate: ActivityStates.Transcribed,
      },
    };

    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: transcribedMedia,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        getTranscriptionText: () => 'Text',
        setComplete: mockSetComplete,
        onReopen: mockOnReopen,
      })
    );

    await act(async () => {
      await result.current.handleReopen();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSetComplete).toHaveBeenCalledWith(false);
    expect(mockOnReopen).toHaveBeenCalled();
  });

  it('handleSave forwards error to saveCompleted when update fails', async () => {
    (mockMemory.update as any).mockRejectedValueOnce(new Error('Save failed'));

    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        getTranscriptionText: () => 'Updated transcription text',
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSaveCompleted).toHaveBeenCalledWith('step1', 'Save failed');
  });

  it('save rethrows error so callers can observe save failures', async () => {
    (mockMemory.update as any).mockRejectedValueOnce(new Error('Save failed'));

    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        getTranscriptionText: () => 'Updated transcription text',
        saveCompleted: mockSaveCompleted,
      })
    );

    await expect(
      result.current.save(ActivityStates.TranscribeReady, 0, undefined, '')
    ).rejects.toThrow('Save failed');
    expect(mockSaveCompleted).toHaveBeenCalledWith('step1', 'Save failed');
  });

  it('handleSubmit does not mark step complete, reload player, or reset position when save fails', async () => {
    (mockMemory.update as any).mockRejectedValueOnce(new Error('Save failed'));

    const { result } = renderHook(() =>
      useTranscribeActions({
        passage: mockPassage,
        mediafile: mockMediafile,
        user: 'user1',
        memory: mockMemory,
        section: mockSection,
        toolId: 'step1',
        hasChecking: true,
        noParatext: false,
        getTranscriptionText: () => 'Completed text',
        setComplete: mockSetComplete,
        onReloadPlayer: mockOnReloadPlayer,
        setPosition: mockSetPosition,
        saveCompleted: mockSaveCompleted,
      })
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(mockSaveCompleted).toHaveBeenCalledWith('step1', 'Save failed');
    expect(mockSetComplete).not.toHaveBeenCalled();
    expect(mockOnReloadPlayer).not.toHaveBeenCalled();
    expect(mockSetPosition).not.toHaveBeenCalled();
  });
});
