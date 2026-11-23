import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPassage = { recording: false };
const mockClipAudio = jest.fn();
const mockInsertAudio = jest.fn();

jest.mock('../context/usePassageDetailContext', () => ({
  __esModule: true,
  default: () => mockPassage,
}));
jest.mock('../utils/audioUtils', () => ({
  clipAudio: (...args: unknown[]) => mockClipAudio(...args),
  insertAudio: (...args: unknown[]) => mockInsertAudio(...args),
}));

// imported after the mocks so the component picks them up
import { AudioCopyPaste, type AudioCopyPasteProps } from './AudioCopyPaste';

const AUDIO = new Blob(['audio']);
const CLIP = new Blob(['clip']);
const INSERTED = new Blob(['inserted']);
const SELECTION = { start: 2, end: 4 };

const renderButtons = (props: Partial<AudioCopyPasteProps> = {}) => {
  const all: AudioCopyPasteProps = {
    audio: AUDIO,
    selection: null,
    at: 3,
    label: 'record',
    onPaste: jest.fn(),
    ...props,
  };
  const view = render(<AudioCopyPaste {...all} />);
  return { ...view, props: all };
};

const query = (name: string) => screen.queryByRole('button', { name });

// The clipboard is shared by the whole module, so the tests that need it empty
// run before the first copy.
describe('AudioCopyPaste', () => {
  beforeEach(() => {
    mockPassage.recording = false;
    mockClipAudio.mockResolvedValue(CLIP);
    mockInsertAudio.mockResolvedValue(INSERTED);
  });

  it('shows no paste before anything is copied', () => {
    renderButtons();
    expect(query('record paste')).not.toBeInTheDocument();
  });

  it('copies the selection, then offers paste once there is no selection', async () => {
    const { rerender, props } = renderButtons({ selection: SELECTION });
    expect(query('record paste')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'record copy' }));
    expect(mockClipAudio).toHaveBeenCalledWith(AUDIO, 2, 4);

    rerender(<AudioCopyPaste {...props} selection={null} />);
    expect(query('record copy')).not.toBeInTheDocument();
    expect(query('record paste')).toBeInTheDocument();
  });

  it('pastes the copied clip at the cursor', async () => {
    const { props } = renderButtons();

    await userEvent.click(screen.getByRole('button', { name: 'record paste' }));

    expect(mockInsertAudio).toHaveBeenCalledWith(AUDIO, 3, CLIP);
    expect(props.onPaste).toHaveBeenCalledWith(INSERTED);
  });

  it('pastes into a player with no audio', async () => {
    const { props } = renderButtons({ audio: null, at: 0 });

    await userEvent.click(screen.getByRole('button', { name: 'record paste' }));

    expect(mockInsertAudio).toHaveBeenCalledWith(null, 0, CLIP);
    expect(props.onPaste).toHaveBeenCalledWith(INSERTED);
  });

  it('disables copy and paste while recording', () => {
    mockPassage.recording = true;
    const { rerender, props } = renderButtons({ selection: SELECTION });
    expect(query('record copy')).toBeDisabled();

    rerender(<AudioCopyPaste {...props} selection={null} />);
    expect(query('record paste')).toBeDisabled();
  });
});
