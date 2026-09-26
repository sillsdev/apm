import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GraphicPicker from './GraphicPicker';

// Regression test for: opening the Graphic Picker should default every
// Scripture ref filter (book/chapter/verse) to checked. Unlike
// GraphicPicker.test.tsx, GraphicImageFilter is NOT mocked here so the
// real Scripture checkboxes render and can be asserted on.

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

jest.mock('../control', () => ({
  Button: ({
    disableTypography,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    disableTypography?: boolean;
  }) => <button {...props} />,
}));

jest.mock('../control/VertScrollBox', () => ({
  VertScrollBox: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('./GraphicUploader', () => ({
  GraphicUploader: () => <div>custom-upload</div>,
}));

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
  placeHolder: 'Search',
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
  onOpen: jest.fn(),
  cancelled: { current: false },
  showMessage: jest.fn(),
  dimension: [40],
  finish: jest.fn(),
  bookCode: 'RUT',
  refString: '1:1-25',
};

function openScriptureFilterSection() {
  fireEvent.click(screen.getByLabelText('Filters'));
  fireEvent.click(screen.getByRole('button', { name: 'Scripture' }));
}

function checkboxFor(rowId: string): HTMLInputElement {
  const row = document.getElementById(rowId);
  const input = row?.querySelector('input[type="checkbox"]');
  if (!input) throw new Error(`no checkbox found for #${rowId}`);
  return input as HTMLInputElement;
}

describe('GraphicPicker Scripture filter defaults', () => {
  it('checks book/chapter/verse by default once scripture resolves true and the dialog opens', () => {
    // Mirrors production: GraphicPicker is mounted once by ScriptureTable
    // before the plan's `scripture` flag and dialog `isOpen` are both true -
    // `scripture` starts false while PlanContext is still resolving, and the
    // dialog itself is not yet open.
    const { rerender } = render(
      <GraphicPicker {...baseProps} isOpen={false} scripture={false} />
    );

    // PlanContext resolves the plan as a Scripture-type plan.
    rerender(<GraphicPicker {...baseProps} isOpen={false} scripture />);

    // User opens the dialog.
    rerender(<GraphicPicker {...baseProps} isOpen scripture />);

    openScriptureFilterSection();

    expect(checkboxFor('graphic-filter-ref-book')).toBeChecked();
    expect(checkboxFor('graphic-filter-ref-chapter')).toBeChecked();
    expect(checkboxFor('graphic-filter-ref-verse')).toBeChecked();
  });

  it('checks book/chapter/verse when scripture resolves true while the dialog is already open', () => {
    // PlanContext (src/renderer/src/context/PlanContext.tsx:134-139) starts
    // `scripture: false` and updates it from the plan in a passive effect,
    // which can commit after the picker is already open (isOpen never
    // changes in this sequence - only `scripture` does).
    const { rerender } = render(
      <GraphicPicker {...baseProps} isOpen scripture={false} />
    );

    // PlanContext resolves the plan as a Scripture-type plan while the
    // dialog remains open the whole time.
    rerender(<GraphicPicker {...baseProps} isOpen scripture />);

    openScriptureFilterSection();

    expect(checkboxFor('graphic-filter-ref-book')).toBeChecked();
    expect(checkboxFor('graphic-filter-ref-chapter')).toBeChecked();
    expect(checkboxFor('graphic-filter-ref-verse')).toBeChecked();
  });
});
