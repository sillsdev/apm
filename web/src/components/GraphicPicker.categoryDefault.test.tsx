import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import GraphicPicker, { NOTE_CATEGORY_STYLE } from './GraphicPicker';

// Regression for TT-7703: Edit Team Categories opens Graphic Picker with
// Note Category checked as the Default filter; Clear clears it; Reset to
// Default restores it. Scripture-plan opens must not check that style.
// The graphics API returns "Note category" (lowercase c); defaults must
// rematch that canonical casing so the checkbox and search agree.
// GraphicImageFilter is NOT mocked so Styles checkboxes can be asserted.

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));

jest.mock('../crud', () => ({
  useOrganizedBy: () => ({
    getOrganizedBy: () => 'Section',
  }),
}));

const STYLE_URL = 'https://graphics.example.com/api/styles';
const SEARCH_URL_BASE = 'https://graphics.example.com/api/search';

/** Canonical spelling returned by the graphics /styles API (screenshot / prod). */
const API_NOTE_CATEGORY_STYLE = 'Note category';

jest.mock('../crud/useGraphicUrlBuilder', () => {
  const getSearchUrl = ({
    filterState,
  }: {
    filterState?: { s?: string; k?: string };
  }) => {
    const params = new URLSearchParams();
    if (filterState?.s) params.set('s', filterState.s);
    if (filterState?.k) params.set('k', filterState.k);
    const q = params.toString();
    return q ? `${SEARCH_URL_BASE}?${q}` : SEARCH_URL_BASE;
  };
  const getKeywordUrl = () => undefined;
  const getStyleUrl = () => STYLE_URL;
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

const NOTE_CATEGORY_ROW_ID = 'graphic-filter-styles-Note-category';

const baseProps = {
  onOpen: jest.fn(),
  cancelled: { current: false },
  showMessage: jest.fn(),
  dimension: [40],
  finish: jest.fn(),
};

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    statusText: 'OK',
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function installFetchMock() {
  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/styles')) {
      return jsonResponse({
        styles: [API_NOTE_CATEGORY_STYLE, 'Impressionist', 'Cinematic'],
      });
    }
    if (url.includes('/search')) {
      return jsonResponse({ images: [] });
    }
    return jsonResponse({});
  });
  const originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  return {
    fetchMock,
    restore: () => {
      global.fetch = originalFetch;
    },
  };
}

async function openStylesFilterSection() {
  fireEvent.click(screen.getByLabelText('Filters'));
  fireEvent.click(screen.getByRole('button', { name: 'Styles' }));
  await waitFor(() => {
    expect(document.getElementById(NOTE_CATEGORY_ROW_ID)).not.toBeNull();
  });
}

function checkboxFor(rowId: string): HTMLInputElement {
  const row = document.getElementById(rowId);
  const input = row?.querySelector('input[type="checkbox"]');
  if (!input) throw new Error(`no checkbox found for #${rowId}`);
  return input as HTMLInputElement;
}

function latestSearchUrl(fetchMock: jest.Mock): string | undefined {
  const searchCalls = fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.includes('/search'));
  return searchCalls[searchCalls.length - 1];
}

describe('GraphicPicker category style defaults (TT-7703)', () => {
  let restoreFetch: () => void;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    const installed = installFetchMock();
    restoreFetch = installed.restore;
    fetchMock = installed.fetchMock;
  });

  afterEach(() => {
    restoreFetch();
  });

  it('checks API "Note category" when defaultSelectedStyles uses different casing', async () => {
    await act(async () => {
      render(
        <GraphicPicker
          {...baseProps}
          isOpen
          scripture={false}
          defaultSelectedStyles={[NOTE_CATEGORY_STYLE]}
        />
      );
    });

    await openStylesFilterSection();

    expect(checkboxFor(NOTE_CATEGORY_ROW_ID)).toBeChecked();
    expect(latestSearchUrl(fetchMock)).toMatch(/[?&]s=Note(\+|%20)category/);
  });

  it('Clear unchecks Note category and drops the style from search', async () => {
    await act(async () => {
      render(
        <GraphicPicker
          {...baseProps}
          isOpen
          scripture={false}
          defaultSelectedStyles={[NOTE_CATEGORY_STYLE]}
        />
      );
    });

    await openStylesFilterSection();
    expect(checkboxFor(NOTE_CATEGORY_ROW_ID)).toBeChecked();

    await act(async () => {
      fireEvent.click(document.getElementById('graphic-filter-clear')!);
    });

    await openStylesFilterSection();
    expect(checkboxFor(NOTE_CATEGORY_ROW_ID)).not.toBeChecked();
    expect(latestSearchUrl(fetchMock) ?? '').not.toMatch(/s=Note/i);
  });

  it('Reset to Default rechecks Note category after Clear', async () => {
    await act(async () => {
      render(
        <GraphicPicker
          {...baseProps}
          isOpen
          scripture={false}
          defaultSelectedStyles={[NOTE_CATEGORY_STYLE]}
        />
      );
    });

    await openStylesFilterSection();
    await act(async () => {
      fireEvent.click(document.getElementById('graphic-filter-clear')!);
    });

    await openStylesFilterSection();
    await act(async () => {
      fireEvent.click(document.getElementById('graphic-filter-reset')!);
    });

    await openStylesFilterSection();
    expect(checkboxFor(NOTE_CATEGORY_ROW_ID)).toBeChecked();
    expect(latestSearchUrl(fetchMock)).toMatch(/[?&]s=Note(\+|%20)category/);
  });

  it('does not check Note category for Scripture-plan opens without defaultSelectedStyles', async () => {
    await act(async () => {
      render(
        <GraphicPicker
          {...baseProps}
          isOpen
          scripture
          bookCode="RUT"
          refString="1:1-25"
        />
      );
    });

    await openStylesFilterSection();
    expect(checkboxFor(NOTE_CATEGORY_ROW_ID)).not.toBeChecked();
  });
});
