jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

jest.mock('../crud', () => ({
  VernacularTag: null,
}));

jest.mock('../selector', () => ({
  sharedSelector: () => undefined,
}));

jest.mock('../control', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ActionRow = ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children);
  ActionRow.displayName = 'ActionRow';
  const Button = ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => React.createElement('button', { type: 'button', onClick }, children);
  Button.displayName = 'Button';
  return { ActionRow, Button, rowSx: {} };
});

jest.mock('./MediaRecord', () => {
  const MockMediaRecord = (props: { mediaId?: string }) => (
    <div data-testid="media-record" data-media-id={props.mediaId ?? ''} />
  );
  MockMediaRecord.displayName = 'MockMediaRecord';
  return { __esModule: true, default: MockMediaRecord };
});

import { render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import TitleRecord from './TitleRecord';

const mockUseSelector = useSelector as unknown as jest.Mock;

const props = {
  recToolId: 'rec',
  titleId: 'title-type',
  passageId: undefined,
  planId: 'plan-1',
  defaultFilename: 'title',
  canSave: false,
  onMyRecording: jest.fn(),
  handleSetCanSave: jest.fn(),
  afterUploadCb: jest.fn(),
  setStatusText: jest.fn(),
};

describe('TitleRecord', () => {
  beforeEach(() => {
    mockUseSelector.mockReturnValue({ cancel: 'Cancel', save: 'Save' });
  });

  it('loads the saved title audio into the recorder', () => {
    render(<TitleRecord {...props} mediaId="media-9" />);

    expect(screen.getByTestId('media-record')).toHaveAttribute(
      'data-media-id',
      'media-9'
    );
  });
});
