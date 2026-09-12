import React from 'react';
import { render } from '@testing-library/react';
import GraphicPicker from './GraphicPicker';

// Regression test for a review comment on the Scripture-default-checked fix
// (PR #601, https://github.com/sillsdev/apm/pull/601#discussion_r3994579140):
// resetting the Scripture ref filter to its default in a `useEffect` runs
// *after* the style/keyword/search fetch effects have already fired once
// with the stale (unfiltered) value for this render, then again once the
// reset commits - two in-flight requests per endpoint that can resolve out
// of order and let the stale response overwrite the corrected one.
//
// `useGraphicUrlBuilder` is NOT mocked here (unlike GraphicPicker.test.tsx /
// GraphicPicker.scriptureDefault.test.tsx) because the race only shows up
// when the built URL actually changes with `scriptureRefChecked`.

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

// Stable reference: a fresh [] on every useSelector call would give
// `bookNameMap` (in useGraphicUrlBuilder) a new dependency each render,
// churning `getSearchUrl`'s identity independent of the fix under test -
// see jest-testing-takeaways.mdc "useOrbitData and useEffect dependency churn".
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

describe('GraphicPicker open Scripture-filter fetch race', () => {
  it('fires exactly one search request on open, already scripture-filtered (no stale unfiltered request)', () => {
    const fetchMock = jest.fn((..._args: unknown[]) =>
      new Promise<Response>(() => undefined)
    );
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      // Mirrors production: GraphicPicker is mounted once by ScriptureTable
      // before the plan's `scripture` flag and dialog `isOpen` are both true.
      const { rerender } = render(
        <GraphicPicker {...baseProps} isOpen={false} scripture={false} />
      );
      rerender(<GraphicPicker {...baseProps} isOpen={false} scripture />);
      // User opens the dialog - the render that fires the fetch effects.
      rerender(<GraphicPicker {...baseProps} isOpen scripture />);

      const searchCalls = fetchMock.mock.calls
        .map((call) => String(call[0]))
        .filter((url) => url.includes('/search'));

      expect(searchCalls).toHaveLength(1);
      expect(searchCalls[0]).toContain('scripture=');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
