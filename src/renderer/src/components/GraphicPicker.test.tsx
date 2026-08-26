import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GraphicPicker from './GraphicPicker';

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));

jest.mock('../crud', () => ({
  useOrganizedBy: () => ({
    getOrganizedBy: () => 'Section',
  }),
}));

jest.mock('../crud/useGraphicUrlBuilder', () => {
  const getSearchUrl = () => undefined;
  const getKeywordUrl = () => undefined;
  const getStyleUrl = () => undefined;
  const refFromQuery = (q: string) => q;
  return {
    useGraphicUrlBuilder: () => ({
      getSearchUrl,
      getKeywordUrl,
      getStyleUrl,
      refFromQuery,
    }),
  };
});

jest.mock('../utils/useCompression', () => ({
  useCompression: () => ({ uploadMedia: jest.fn(), showFile: jest.fn() }),
}));

jest.mock('../utils/useDebounce', () => ({
  useDebounce: (v: string) => v,
}));

jest.mock('../utils/logErrorService', () => ({
  __esModule: true,
  default: jest.fn(),
  Severity: { error: 'error' },
}));

jest.mock('./GraphicImageFilter', () => ({
  GraphicImageFilter: () => null,
}));

jest.mock('../control', () => ({
  PriButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
  AltButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
}));

jest.mock('../control/VertScrollBox', () => ({
  VertScrollBox: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('./GraphicUploader', () => {
  const handleAddOrSave = jest.fn();
  return {
    mockHandleAddOrSave: handleAddOrSave,
    GraphicUploader: (props: {
      metadata?: React.ReactNode;
      onFiles?: (files: File[]) => void;
      mediaUploadControlsRef?: {
        current: {
          handleAddOrSave: unknown;
          handleCancel: unknown;
        };
      };
    }) => {
      if (props.mediaUploadControlsRef) {
        props.mediaUploadControlsRef.current.handleAddOrSave = handleAddOrSave;
        props.mediaUploadControlsRef.current.handleCancel = jest.fn();
      }
      return (
        <div>
          custom-upload
          {props.metadata}
          <button
            type="button"
            onClick={() =>
              props.onFiles?.([
                new File(['x'], 'a.png', { type: 'image/png' }),
              ])
            }
          >
            pick-file
          </button>
        </div>
      );
    },
  };
});

jest.mock('./GraphicRights', () => ({
  __esModule: true,
  default: ({ value }: { value?: string }) => <div>rights:{value}</div>,
}));

const graphicStrings = {
  tabBible: 'Library',
  tabCustom: 'Custom',
  tabCurrent: 'Current',
  graphicSource: 'graphic source tabs',
  title: 'Graphic Picker',
  graphicSearch: 'Search graphics',
  noSelection: 'no {0} selected.',
  noResults: 'No matching images found.',
  loadFailure: 'Failed to load',
  keywordSearchHint: 'keyword hint',
  setGraphic: 'Set as Graphic',
  graphicDisplay: 'Display current graphic',
};

const sharedStrings = {
  cancel: 'Cancel',
};

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn((sel: (s: unknown) => unknown) =>
    sel({
      strings: { graphic: graphicStrings, shared: sharedStrings },
      books: { bookData: [] },
    })
  ),
  shallowEqual: (a: unknown, b: unknown) => a === b,
}));

jest.mock('../selector', () => ({
  graphicStringsSelector: (state: {
    strings: { graphic: typeof graphicStrings };
  }) => state.strings.graphic,
  sharedSelector: (state: { strings: { shared: typeof sharedStrings } }) =>
    state.strings.shared,
}));

const baseProps = {
  isOpen: true,
  onOpen: jest.fn(),
  cancelled: { current: false },
  showMessage: jest.fn(),
  dimension: [40],
  finish: jest.fn(),
};

describe('GraphicPicker', () => {
  it('shows no-selection when scripture context is missing', () => {
    render(<GraphicPicker {...baseProps} scripture />);
    expect(screen.getByText('no Section selected.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search graphics')).not.toBeInTheDocument();
  });

  it('shows the library search when scripture is false', () => {
    render(<GraphicPicker {...baseProps} scripture={false} />);
    expect(screen.getByLabelText('Search graphics')).toBeInTheDocument();
    expect(screen.queryByText(/no .* selected/i)).not.toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('shows the current graphic on the Current tab', async () => {
    render(
      <GraphicPicker
        {...baseProps}
        scripture={false}
        currentUrl="https://example.com/g.jpg"
        currentRights="SIL"
      />
    );
    await waitFor(() => {
      expect(screen.getByAltText('Display current graphic')).toHaveAttribute(
        'src',
        'https://example.com/g.jpg'
      );
    });
    expect(screen.getByText('SIL')).toBeInTheDocument();
  });

  it('does not close-save when Custom Set Graphic starts an upload', () => {
    const { mockHandleAddOrSave } = jest.requireMock('./GraphicUploader') as {
      mockHandleAddOrSave: jest.Mock;
    };
    mockHandleAddOrSave.mockClear();
    const onOpen = jest.fn();
    render(<GraphicPicker {...baseProps} scripture={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set as Graphic' }));
    expect(mockHandleAddOrSave).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('reseeds Custom rights when currentRights updates while open', () => {
    const { rerender } = render(
      <GraphicPicker {...baseProps} scripture={false} currentRights="cached" />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    expect(screen.getByText('rights:cached')).toBeInTheDocument();
    rerender(
      <GraphicPicker {...baseProps} scripture={false} currentRights="fresh" />
    );
    expect(screen.getByText('rights:fresh')).toBeInTheDocument();
  });

  it('revokes blob preview URLs when replaced or closed', () => {
    const create = jest
      .fn()
      .mockReturnValueOnce('blob:preview-1')
      .mockReturnValueOnce('blob:preview-2');
    const revoke = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: create,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    const { rerender } = render(
      <GraphicPicker {...baseProps} scripture={false} />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick-file' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick-file' }));
    expect(revoke).toHaveBeenCalledWith('blob:preview-1');
    rerender(<GraphicPicker {...baseProps} scripture={false} isOpen={false} />);
    expect(revoke).toHaveBeenCalledWith('blob:preview-2');
  });
});
