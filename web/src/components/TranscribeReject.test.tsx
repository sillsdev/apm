import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { ActivityStates, MediaFile } from '../model';
import TranscribeReject from './TranscribeReject';

jest.mock('react-redux', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useSelector: () => ({
    rejectTitle: 'Reject',
    rejectReason: 'Reason',
    needsAudio: 'Needs audio',
    needsCorrection: 'Needs correction',
    incomplete: 'Incomplete',
    comment: 'Comment',
    cancel: 'Cancel',
    reject: 'Reject',
  }),
}));

jest.mock('../selector', () => ({
  transcribeRejectSelector: jest.fn(),
  transcriberSelector: jest.fn(),
}));

jest.mock('../control', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  commentProps: {},
}));

const mediaIn = {
  id: 'media-1',
  attributes: { transcriptionstate: ActivityStates.Transcribing },
} as MediaFile;

describe('TranscribeReject', () => {
  it('clears a canceled rejection comment when the dialog opens again', () => {
    const cancelMethod = jest.fn();
    const { rerender } = render(
      <TranscribeReject
        mediaIn={mediaIn}
        visible={true}
        cancelMethod={cancelMethod}
      />
    );

    const comment = document.getElementById(
      'reject-comment'
    ) as HTMLInputElement;
    fireEvent.change(comment, { target: { value: 'Test' } });
    fireEvent.click(document.getElementById('transcriberReject.cancel')!);

    rerender(
      <TranscribeReject
        mediaIn={mediaIn}
        visible={false}
        cancelMethod={cancelMethod}
      />
    );
    rerender(
      <TranscribeReject
        mediaIn={mediaIn}
        visible={true}
        cancelMethod={cancelMethod}
      />
    );

    expect(
      (document.getElementById('reject-comment') as HTMLInputElement).value
    ).toBe('');
  });
});
