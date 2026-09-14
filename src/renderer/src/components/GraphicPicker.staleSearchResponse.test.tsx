import React from 'react';
import { act, render, screen } from '@testing-library/react';
import GraphicPicker from './GraphicPicker';

// Regression test for a follow-up review comment on PR #601
// (src/renderer/src/components/GraphicPicker.tsx:R412-418): late Scripture
// resolution starts a filtered search while an earlier, unfiltered search is
// still in flight. `runBibleFetch` had no cancellation/generation guard, so
// whichever response resolves *last* wins - even if it's the stale one. That
// leaves the Scripture checkboxes checked (correct) while the displayed
// images silently revert to the unfiltered set (wrong).
//
// `useGraphicUrlBuilder` is NOT mocked (like GraphicPicker.openFetchRace.test.tsx)
// because the two requests must be distinguishable by their built URL.

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));

jest.mock('../crud', () => ({
  useOrganizedBy: () => ({ getOrganizedBy: () => 'Section' }),
}));

jest.mock('../../api-variable', () => ({
  API_CONFIG: { graphicApiBase: 'https://graphics.example.com/api' },
}));

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
};

const sharedStrings = {
  cancel: 'Cancel',
};

// Stable reference - see jest-testing-takeaways.mdc "useOrbitData and
// useEffect dependency churn": a fresh [] on every useSelector call would
// give `bookNameMap` (in useGraphicUrlBuilder) a new identity each render,
// churning `getSearchUrl` independent of the fix under test.
const mockBookData: never[] = [];

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn((sel: (s: unknown) => unknown) =>
    sel({
      strings: { graphic: graphicStrings, shared: sharedStrings, lang: 'en' },
      books: { bookData: mockBookData },
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

const unfilteredImages = [
  {
    uuid: 'unfiltered-1',
    title: 'Unfiltered Image',
    keywords: [],
    styles: [],
    copyright: null,
  },
];
const filteredImages = [
  {
    uuid: 'filtered-1',
    title: 'Filtered Image',
    keywords: [],
    styles: [],
    copyright: null,
  },
];

function fakeResponse(body: unknown): Response {
  return {
    ok: true,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeDeferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('GraphicPicker stale search response', () => {
  it('keeps the scripture-filtered images even if the earlier unfiltered request resolves last', async () => {
    const unfilteredRequest = makeDeferred();
    const filteredRequest = makeDeferred();
    const fetchMock = jest.fn((input: unknown) => {
      const url = String(input);
      if (!url.includes('/search')) {
        // style/keyword requests: irrelevant to this test, never resolve.
        return new Promise<Response>(() => undefined);
      }
      return url.includes('scripture=')
        ? filteredRequest.promise
        : unfilteredRequest.promise;
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      // Dialog opens while PlanContext still reports scripture: false - the
      // unfiltered search effect fires and its (slow) request is in flight.
      const { rerender } = render(
        <GraphicPicker {...baseProps} isOpen scripture={false} />
      );

      // PlanContext resolves the plan as Scripture-type while still open -
      // the render-time reset re-fires the search effect, now filtered.
      rerender(<GraphicPicker {...baseProps} isOpen scripture />);

      // The filtered (later-issued) request wins the race, resolving first.
      await act(async () => {
        filteredRequest.resolve(fakeResponse(filteredImages));
        await flushMicrotasks();
      });
      expect(screen.getByText('Filtered Image')).toBeInTheDocument();

      // The stale, unfiltered (earlier-issued) request finally resolves.
      await act(async () => {
        unfilteredRequest.resolve(fakeResponse(unfilteredImages));
        await flushMicrotasks();
      });

      // The stale response must not resurrect the unfiltered results.
      expect(screen.getByText('Filtered Image')).toBeInTheDocument();
      expect(screen.queryByText('Unfiltered Image')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
