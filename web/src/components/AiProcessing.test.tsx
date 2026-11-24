import { fireEvent, render } from '@testing-library/react';
import { AiProcessing } from './AiProcessing';

jest.mock('react-redux', () => ({
  useSelector: () => ({ aiInProgress: 'AI in progress', cancel: 'Cancel' }),
  shallowEqual: jest.fn(),
}));

jest.mock('../selector', () => ({
  wsAudioPlayerSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

jest.mock('../control', () => ({
  Button: ({
    children,
    disabled,
    id,
    onClick,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    id?: string;
    onClick?: () => void;
  }) => (
    <button type="button" id={id} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

const cancelButton = () =>
  document.getElementById('ai-cancel') as HTMLButtonElement;

describe('AiProcessing', () => {
  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();
    render(<AiProcessing onCancel={onCancel} />);

    fireEvent.click(cancelButton());

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // TT-7791: once the result is being applied, canceling would leave the
  // player and Save holding different audio.
  it('disables Cancel when cancelDisabled is set', () => {
    const onCancel = jest.fn();
    render(<AiProcessing onCancel={onCancel} cancelDisabled />);

    expect(cancelButton().disabled).toBe(true);
    fireEvent.click(cancelButton());
    expect(onCancel).not.toHaveBeenCalled();
  });
});
