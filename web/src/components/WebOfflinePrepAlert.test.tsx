import { act, render, screen } from '@testing-library/react';

let mockProject = 'proj-1';
let mockOffline: Record<string, boolean> = {};
jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => [
    key === 'project' ? mockProject : undefined,
    jest.fn(),
  ],
}));
jest.mock('../crud/useOfflnProjRead', () => ({
  useOfflnProjRead: () => (projectId: string) => ({
    attributes: { offlineAvailable: Boolean(mockOffline[projectId]) },
  }),
}));
let mockCb: (() => void) | undefined;
jest.mock('./ProjectDownloadAlert', () => ({
  __esModule: true,
  default: (props: { projectId: string; cb: () => void }) => {
    mockCb = props.cb;
    return <div>alert for {props.projectId}</div>;
  },
}));

import { WebOfflinePrepAlert } from './WebOfflinePrepAlert';

describe('WebOfflinePrepAlert', () => {
  beforeEach(() => {
    mockProject = 'proj-1';
    mockOffline = {};
    mockCb = undefined;
  });

  it('stays closed without offline intent (lazy mode)', () => {
    render(<WebOfflinePrepAlert />);
    expect(screen.queryByText(/alert for/)).toBeNull();
  });

  it('offers offline prep for the open project with offline intent', () => {
    mockOffline = { 'proj-1': true };
    render(<WebOfflinePrepAlert />);
    expect(screen.getByText('alert for proj-1')).toBeTruthy();
  });

  it('stays closed after the user closes it until the project changes', () => {
    mockOffline = { 'proj-1': true, 'proj-2': true };
    const { rerender } = render(<WebOfflinePrepAlert />);
    act(() => mockCb?.());
    rerender(<WebOfflinePrepAlert />);
    expect(screen.queryByText(/alert for/)).toBeNull();

    mockProject = 'proj-2';
    rerender(<WebOfflinePrepAlert />);
    expect(screen.getByText('alert for proj-2')).toBeTruthy();
  });
});
