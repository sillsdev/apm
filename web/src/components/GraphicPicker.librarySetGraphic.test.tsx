import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import GraphicPicker from './GraphicPicker';

// TT-7725: Library "Set as Graphic" must not re-fetch orig_url (CORS on
// CloudFront). Store the CDN URLs from the search payload instead.

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));

jest.mock('../crud', () => ({
  useOrganizedBy: () => ({
    getOrganizedBy: () => 'Section',
  }),
}));

const SEARCH_URL = 'https://graphics.example.com/api/search';
const STYLE_URL = 'https://graphics.example.com/api/styles';

const ORIG_URL = 'https://d12do9t5rj179j.cloudfront.net/orig/1352.png';
const THUMB_LARGE = 'https://d12do9t5rj179j.cloudfront.net/thumb/640/1352.png';
const THUMB_SMALL = 'https://d12do9t5rj179j.cloudfront.net/thumb/320/1352.png';

jest.mock('../crud/useGraphicUrlBuilder', () => {
  const getSearchUrl = () => SEARCH_URL;
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

const mockUploadMedia = jest.fn();

jest.mock('../utils/useCompression', () => ({
  useCompression: () => ({
    uploadMedia: mockUploadMedia,
    showFile: jest.fn(),
  }),
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

const libraryImage = {
  id: 1352,
  uuid: 'lib-key-1352',
  title: 'Key graphic',
  keywords: [],
  styles: ['Note category'],
  orig_url: ORIG_URL,
  thumb_url_small: THUMB_SMALL,
  thumb_url_large: THUMB_LARGE,
  s3key: 'orig/1352.png',
  sort_order: 0,
  created_at: '',
  updated_at: '',
  submitted_by: '',
  submitted_by_email: '',
  is_published: true,
  is_featured: false,
  updated_by: '',
  updated_by_email: '',
  description: null,
  external_id: null,
  default_language_code: 'en',
  original_file_name: '1352.png',
  authors: null,
  copyright: 'SIL',
  scriptures: [],
};

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    statusText: 'OK',
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function isImageUrl(url: string): boolean {
  return (
    url.includes('cloudfront.net') ||
    url.endsWith('.png') ||
    url.endsWith('.jpg')
  );
}

describe('GraphicPicker Library Set as Graphic (TT-7725)', () => {
  let restoreFetch: (() => void) | undefined;
  const finish = jest.fn();
  const onOpen = jest.fn();
  const onSelectedRights = jest.fn();

  beforeEach(() => {
    finish.mockClear();
    onOpen.mockClear();
    onSelectedRights.mockClear();
    mockUploadMedia.mockClear();

    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/styles')) {
        return jsonResponse({ styles: ['Note category'] });
      }
      if (url.includes('/search')) {
        return jsonResponse({ results: [libraryImage] });
      }
      if (isImageUrl(url)) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return jsonResponse({});
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    restoreFetch = () => {
      global.fetch = originalFetch;
    };
  });

  afterEach(() => {
    restoreFetch?.();
  });

  it('finishes with CDN URLs when image byte fetch would fail CORS', async () => {
    await act(async () => {
      render(
        <GraphicPicker
          isOpen
          scripture={false}
          onOpen={onOpen}
          cancelled={{ current: false }}
          showMessage={jest.fn()}
          dimension={[1024, 512, 40]}
          finish={finish}
          onSelectedRights={onSelectedRights}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByAltText('Key graphic')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByAltText('Key graphic'));
    fireEvent.click(screen.getByRole('button', { name: 'Set as Graphic' }));

    await waitFor(() => {
      expect(finish).toHaveBeenCalledTimes(1);
    });

    expect(mockUploadMedia).not.toHaveBeenCalled();
    expect(onSelectedRights).toHaveBeenCalledWith('SIL');
    expect(onOpen).toHaveBeenCalledWith(false);

    const images = finish.mock.calls[0][0] as Array<{
      content: string;
      dimension: number;
      type: string;
    }>;
    expect(images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: ORIG_URL,
          dimension: 1024,
          type: 'image/png',
        }),
        expect.objectContaining({
          content: THUMB_LARGE,
          dimension: 512,
          type: 'image/png',
        }),
        expect.objectContaining({
          content: THUMB_SMALL,
          dimension: 40,
          type: 'image/png',
        }),
      ])
    );
    expect(images).toHaveLength(3);
  });
});
