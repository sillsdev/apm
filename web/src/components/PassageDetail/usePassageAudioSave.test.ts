import { act, renderHook } from '@testing-library/react';

interface IUploadProps {
  afterUploadCb: (mediaId: string) => Promise<void>;
}

const mockUpload = jest.fn();
let mockGlobals: Record<string, unknown> = {};
// The passage's stored versions, by file name.
let mockVersions: string[] = [];

jest.mock('react-redux', () => ({ useSelector: jest.fn() }));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => [mockGlobals[key], jest.fn()],
}));

jest.mock('../../context/usePassageDetailContext', () => () => ({
  passage: { id: 'p1' },
  currentstep: 'step1',
}));

jest.mock('../../crud', () => ({
  VernacularTag: null,
  useSharedResRead: () => ({ getSharedResource: jest.fn() }),
  // An upload reports to the callback of the render that started it, so a save
  // running across an edit must still report the audio it stored.
  useMediaUpload: (props: IUploadProps) => (files: File[]) =>
    mockUpload(files, props),
}));

jest.mock('../../crud/autosaveMedia', () => ({
  AutosaveSuffix: '_autosave',
  removeAllAutosaves: jest.fn(() => {
    mockVersions = mockVersions.filter((name) => !name.includes('_autosave'));
  }),
  // Keeps the newest autosave, and the test reading mockVersions stores only one.
  removeOldAutosaves: jest.fn(),
}));

jest.mock('../../crud/useStepTool', () => ({
  useStepTool: () => ({ settings: '' }),
}));

jest.mock('../../utils/passageDefaultFilename', () => ({
  passageDefaultFilename: () => 'base',
}));

import {
  removeAllAutosaves,
  removeOldAutosaves,
} from '../../crud/autosaveMedia';
import { AutosaveIntervalMs, usePassageAudioSave } from './usePassageAudioSave';

type Props = Parameters<typeof usePassageAudioSave>[0];

const memory = {};
const reporter = {};
const autosaveProps = {
  memory,
  passageId: 'p1',
  planId: 'plan1',
  offline: false,
  reporter,
};

// The file extension shows which of these an upload carried.
const wavBlob = new Blob(['first'], { type: 'audio/wav' });
const webmBlob = new Blob(['second'], { type: 'audio/webm' });

// The real upload calls afterUploadCb and then settles; a failed one has no
// media id.
const succeed = async (files: File[], props: IUploadProps) => {
  mockVersions.push(...files.map((file) => file.name));
  await props.afterUploadCb('media1');
};

const fail = async (_files: File[], props: IUploadProps) => {
  await props.afterUploadCb('');
  throw new Error('upload failed');
};

/** Keeps the next upload running until the returned function is called. */
const holdNextUpload = (outcome = succeed) => {
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = () => resolve();
  });
  mockUpload.mockImplementationOnce(
    async (files: File[], props: IUploadProps) => {
      await finished;
      await outcome(files, props);
    }
  );
  return () => finish();
};

/** Lets time pass, along with the promises that settle during it. */
const elapse = (ms = 0) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

const uploadedNames = () =>
  mockUpload.mock.calls.map(([files]) => (files as File[])[0]?.name);

const setup = (overrides: Partial<Props> = {}) => {
  const onStored = jest.fn();
  const initialProps: Props = {
    passageId: 'p1',
    currentBlob: wavBlob,
    edited: true,
    enabled: true,
    performedBy: 'Speaker',
    onStored,
    ...overrides,
  };
  const view = renderHook((props: Props) => usePassageAudioSave(props), {
    initialProps,
  });
  const update = (changes: Partial<Props> = {}) =>
    view.rerender({ ...initialProps, ...changes });
  return { ...view, onStored, update };
};

describe('usePassageAudioSave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUpload.mockReset();
    mockUpload.mockImplementation(succeed);
    mockVersions = [];
    mockGlobals = {
      offline: false,
      connected: true,
      memory,
      plan: 'plan1',
      errorReporter: reporter,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('autosave', () => {
    it('stores an edit once the interval has passed', async () => {
      setup();

      await elapse(AutosaveIntervalMs - 1);
      expect(uploadedNames()).toEqual([]);

      await elapse(1);
      expect(uploadedNames()).toEqual(['base_autosave.wav']);
    });

    it('restarts the wait when the audio changes again', async () => {
      const { update } = setup();

      await elapse(AutosaveIntervalMs - 1);
      update({ currentBlob: webmBlob });

      await elapse(AutosaveIntervalMs - 1);
      expect(uploadedNames()).toEqual([]);

      await elapse(1);
      expect(uploadedNames()).toEqual(['base_autosave.webm']);
    });

    it.each<[string, Partial<Props>]>([
      ['there is no audio', { currentBlob: null }],
      ['nothing is edited', { edited: false }],
      ['it is not enabled', { enabled: false }],
    ])('does not run when %s', async (_name, overrides) => {
      setup(overrides);

      await elapse(AutosaveIntervalMs);

      expect(uploadedNames()).toEqual([]);
    });

    it('drops a waiting autosave when it stops being enabled', async () => {
      const { update } = setup();

      await elapse(AutosaveIntervalMs - 1);
      update({ enabled: false });
      await elapse(AutosaveIntervalMs);

      expect(uploadedNames()).toEqual([]);
    });

    it('waits out a network loss and runs once the connection returns', async () => {
      mockGlobals.connected = false;
      const { update } = setup();

      await elapse(AutosaveIntervalMs);
      expect(uploadedNames()).toEqual([]);

      mockGlobals.connected = true;
      update();
      await elapse(AutosaveIntervalMs);
      expect(uploadedNames()).toEqual(['base_autosave.wav']);
    });

    it('runs without a connection under Work Offline', async () => {
      mockGlobals.offline = true;
      mockGlobals.connected = false;
      setup();

      await elapse(AutosaveIntervalMs);

      expect(uploadedNames()).toEqual(['base_autosave.wav']);
    });

    it('reports the stored audio and removes only the older autosaves', async () => {
      const { onStored } = setup();

      await elapse(AutosaveIntervalMs);

      expect(onStored).toHaveBeenCalledWith(wavBlob);
      expect(removeOldAutosaves).toHaveBeenCalledWith(autosaveProps);
      expect(removeAllAutosaves).not.toHaveBeenCalled();
    });

    it('holds a newer edit until the running autosave finishes', async () => {
      const finish = holdNextUpload();
      const { onStored, update } = setup();

      await elapse(AutosaveIntervalMs);
      update({ currentBlob: webmBlob });
      await elapse(AutosaveIntervalMs);
      expect(uploadedNames()).toEqual(['base_autosave.wav']);

      finish();
      await elapse();
      // The newer edit isn't stored yet, so it must stay marked as unsaved.
      expect(onStored).toHaveBeenCalledTimes(1);
      expect(onStored).toHaveBeenCalledWith(wavBlob);

      await elapse(AutosaveIntervalMs);
      expect(uploadedNames()).toEqual([
        'base_autosave.wav',
        'base_autosave.webm',
      ]);
    });

    it('tries again an interval after a failure', async () => {
      // Held because a real upload settles after the render that shows it running.
      const finish = holdNextUpload(fail);
      const { result, onStored } = setup();

      await elapse(AutosaveIntervalMs);
      finish();
      await elapse();
      expect(onStored).not.toHaveBeenCalled();
      expect(removeOldAutosaves).not.toHaveBeenCalled();
      expect(result.current.saving).toBe(false);

      await elapse(AutosaveIntervalMs);
      expect(uploadedNames()).toHaveLength(2);
      expect(onStored).toHaveBeenCalledWith(wavBlob);
    });
  });

  describe('save', () => {
    it('stores a permanent version and removes all autosaves', async () => {
      const { result, onStored } = setup();

      await act(async () => {
        await expect(result.current.save()).resolves.toBe(wavBlob);
      });

      expect(uploadedNames()).toEqual(['base.wav']);
      expect(onStored).toHaveBeenCalledWith(wavBlob);
      expect(removeAllAutosaves).toHaveBeenCalledWith(autosaveProps);
    });

    it('uploads nothing when there is no audio', async () => {
      const { result } = setup({ currentBlob: null });

      await act(async () => {
        await expect(result.current.save()).resolves.toBeNull();
      });

      expect(mockUpload).not.toHaveBeenCalled();
      expect(removeAllAutosaves).not.toHaveBeenCalled();
    });

    it('rejects and keeps the autosaves when the upload fails', async () => {
      mockUpload.mockImplementationOnce(fail);
      const { result, onStored } = setup();

      await act(async () => {
        await expect(result.current.save()).rejects.toThrow('upload failed');
      });

      expect(onStored).not.toHaveBeenCalled();
      expect(removeAllAutosaves).not.toHaveBeenCalled();
      expect(result.current.saving).toBe(false);
    });

    it('keeps the saved audio and no autosave when an autosave is running', async () => {
      const finishAutosave = holdNextUpload();
      const finishSave = holdNextUpload();
      const { result, update } = setup();

      await elapse(AutosaveIntervalMs);
      update({ currentBlob: webmBlob });
      act(() => {
        void result.current.save();
      });

      finishAutosave();
      await elapse();
      finishSave();
      await elapse();

      expect(mockVersions).toEqual(['base.webm']);
    });
  });
});
