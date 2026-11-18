/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadPendingLeaveDialog } from './UploadPendingLeaveDialog';

jest.mock('../../selector', () => ({
  mediaTabSelector: { name: 'mediaTabSelector' },
  sharedSelector: { name: 'sharedSelector' },
}));

const strings = {
  pendingUploadTitle: 'Pending media uploads',
  pendingUploadLeavePrompt: 'Upload before switching?',
  pendingUploadLeaveLogoutPrompt: 'Upload before logout?',
  pendingUploadLeaveAfterSwitchPrompt: 'Upload previous project now?',
  pendingUploadLeaveUpload: 'Upload all',
  pendingUploadLeaveUploadFailed: 'Some recordings could not be uploaded.',
  pendingUploadLeaveContinue: 'Continue without uploading',
  pendingUploadLeaveLossWarn: 'This will permanently remove recordings.',
  pendingUploadRetryLater: 'Try again when online.',
  cancel: 'Cancel',
  yes: 'Yes',
};

jest.mock('react-redux', () => ({
  useSelector: () => strings,
  shallowEqual: jest.fn(),
}));

const handlers = () => ({
  onUploadAll: jest.fn(),
  onContinueWithoutUpload: jest.fn(),
  onConfirmDiscard: jest.fn(),
  onCancel: jest.fn(),
});

const base = { busy: false, canUpload: true, uploadFailed: false };

describe('UploadPendingLeaveDialog', () => {
  it('prompts to upload all before switching projects', () => {
    const h = handlers();
    render(
      <UploadPendingLeaveDialog
        {...base}
        {...h}
        phase="prompt"
        reason="switch"
      />
    );

    expect(screen.getByText('Upload before switching?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upload all' }));
    expect(h.onUploadAll).toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue without uploading' })
    );
    expect(h.onContinueWithoutUpload).toHaveBeenCalled();
  });

  it('lets the user cancel the prompt and stay', () => {
    const h = handlers();
    render(
      <UploadPendingLeaveDialog
        {...base}
        {...h}
        phase="prompt"
        reason="switch"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.onCancel).toHaveBeenCalled();
  });

  it('warns of data loss before discard', () => {
    const h = handlers();
    render(
      <UploadPendingLeaveDialog {...base} {...h} phase="warn" reason="switch" />
    );

    expect(
      screen.getByText('This will permanently remove recordings.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(h.onConfirmDiscard).toHaveBeenCalled();
  });

  it('uses the logout prompt when leaving via logout', () => {
    render(
      <UploadPendingLeaveDialog
        {...base}
        {...handlers()}
        phase="prompt"
        reason="logout"
      />
    );
    expect(screen.getByText('Upload before logout?')).toBeInTheDocument();
  });

  it('asks about the previous project after a switch that skipped the gate', () => {
    render(
      <UploadPendingLeaveDialog
        {...base}
        {...handlers()}
        phase="prompt"
        reason="afterSwitch"
      />
    );
    expect(
      screen.getByText('Upload previous project now?')
    ).toBeInTheDocument();
  });

  it('disables Upload all and says why while offline', () => {
    render(
      <UploadPendingLeaveDialog
        {...base}
        {...handlers()}
        canUpload={false}
        phase="prompt"
        reason="switch"
      />
    );
    expect(screen.getByRole('button', { name: 'Upload all' })).toBeDisabled();
    expect(screen.getByText('Try again when online.')).toBeInTheDocument();
  });

  it('says when Upload all left recordings behind', () => {
    render(
      <UploadPendingLeaveDialog
        {...base}
        {...handlers()}
        uploadFailed
        phase="prompt"
        reason="switch"
      />
    );
    expect(
      screen.getByText('Some recordings could not be uploaded.')
    ).toBeInTheDocument();
  });
});
