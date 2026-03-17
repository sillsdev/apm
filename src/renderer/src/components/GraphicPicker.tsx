import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { BookName, IGraphicStrings, IState } from '../model';
import {
  GraphicImageFilter,
  type GraphicImageSortBy,
  type ScriptureReferenceFilter,
  type ScriptureRefChecked,
} from './GraphicImageFilter';
import { StyledDialogTitle } from './StyledDialogTitle';
import { PriButton, AltButton } from '../control';
import { ISharedStrings } from '../model';
import { shallowEqual, useSelector } from 'react-redux';
import { graphicStringsSelector, sharedSelector } from '../selector';
import {
  useGraphicUrlBuilder,
  GraphicFilterState,
} from '../crud/useGraphicUrlBuilder';
import { useDebounce } from '../utils/useDebounce';
import type { BibleImage } from '../model/bibleImage';
import { MediaUploadControlsRef } from './MediaUploadContent';
import { getRefFilter } from './getRefFilter';
import { getUrlNameAndExt } from '../utils/getUrlNameAndExt';
import { urlToFile } from '../utils/urlToFile';
import { CompressedImages, useCompression } from '../utils/useCompression';
import { mimeMap } from '../utils/loadBlob';
import { useOrganizedBy } from '../crud';
import { chapterMatch, refMatch } from '../utils/refMatch';
import { VertScrollBox } from '../control/VertScrollBox';
import logError, { Severity } from '../utils/logErrorService';
import { useGlobal } from '../context/useGlobal';

const DEFAULT_EXCLUDED_STYLES = ['maps', 'diagram'];

export interface GraphicPickerImage {
  id: string;
  url?: string;
  thumbnailUrl?: string;
  label?: string;
  keywords?: string[];
  styles?: string[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`graphic-picker-tabpanel-${index}`}
      aria-labelledby={`graphic-picker-tab-${index}`}
      style={{
        display: value === index ? 'flex' : 'none',
        flex: 1,
        flexDirection: 'column',
        minHeight: 0,
      }}
      {...other}
    >
      {value === index && (
        <Box
          sx={{
            py: 1,
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {children}
        </Box>
      )}
    </div>
  );
}

function GraphicGridItem({
  image,
  selected,
  onSelect,
}: {
  image: GraphicPickerImage;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      sx={{
        width: '100%',
        aspectRatio: '1',
        p: 0,
        border: 2,
        borderRadius: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'action.hover',
        cursor: 'pointer',
        display: 'block',
        overflow: 'hidden',
      }}
    >
      {image.thumbnailUrl || image.url ? (
        <Box
          component="img"
          src={image.thumbnailUrl ?? image.url}
          alt={image.label ?? image.id}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            typography: 'caption',
            color: 'text.secondary',
          }}
        >
          {image.label ?? image.id}
        </Box>
      )}
    </Box>
  );
}

function bibleImageToPickerImage(b: BibleImage): GraphicPickerImage {
  return {
    id: b.uuid,
    url: b.orig_url,
    thumbnailUrl: b.thumb_url_large,
    label: b.title,
    keywords: b.keywords,
    styles: b.styles,
  };
}

function parseBibleImageResponse(data: unknown): BibleImage[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const arr = o.results ?? o.data ?? o.items;
    return Array.isArray(arr) ? arr : [];
  }
  return [];
}

interface Keyword {
  keyword: string;
  count: number;
}
interface KeywordResponse {
  keywords: Keyword[];
}

function parseKeywordResponse(data: unknown): Keyword[] {
  if (Array.isArray((data as KeywordResponse)?.keywords))
    return (data as KeywordResponse).keywords;
  return [];
}

interface StyleResponse {
  styles: string[];
}

function parseStyleResponse(data: unknown): string[] {
  if (Array.isArray((data as StyleResponse)?.styles))
    return (data as StyleResponse).styles;
  return [];
}

function runBibleFetch<T>({
  getUrl,
  parse,
  onSuccess,
  onFailure,
  setLoading,
  setError,
  t,
}: {
  getUrl: () => string | undefined;
  parse: (data: unknown) => T;
  onSuccess: (result: T) => void;
  onFailure: () => void;
  setLoading: (value: boolean) => void;
  setError: (message: string | null) => void;
  t: IGraphicStrings;
}) {
  const url = getUrl();
  if (!url) return;

  setLoading(true);
  setError(null);

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    })
    .then((data: unknown) => {
      const parsed = parse(data);
      onSuccess(parsed);
    })
    .catch((err) => {
      setError(err instanceof Error ? err.message : t.loadFailure);
      onFailure();
    })
    .finally(() => setLoading(false));
}

export interface GraphicPickerProps {
  isOpen: boolean;
  onOpen: (open: boolean) => void;
  onCancel?: () => void;
  /** Book code */
  bookCode: string;
  /** Reference string */
  refString: string;
  /** Filter state passed to getSearchUrl (style/keyword) */
  filterState?: GraphicFilterState;
  /** Images for the Custom tab */
  customImages?: GraphicPickerImage[];
  /** Placeholder for the search input */
  filterActive?: boolean;
  /** Called when the filter IconButton is clicked */
  onFilterClick?: () => void;
  /** Optional title override */
  metadata?: React.ReactNode;
  /** Current graphic selected */
  currentGraphic?: React.ReactNode;
  /** Ref to control media upload actions */
  mediaUploadControlsRef?: React.RefObject<MediaUploadControlsRef>;
  /** Called when the save button is disabled */
  saveDisabled?: boolean;
  /** Show a message to the user */
  showMessage: (msg: string | React.JSX.Element) => void;
  /** Dimension of the image to compress */
  dimension: number[];
  /** Default filename for the image */
  defaultFilename?: string;
  /** Finish callback for the compression */
  finish: (images: CompressedImages[]) => void;
}

export function GraphicPicker({
  isOpen,
  onOpen,
  onCancel,
  bookCode,
  refString,
  customImages = [],
  metadata,
  currentGraphic,
  mediaUploadControlsRef,
  saveDisabled,
  showMessage,
  dimension,
  defaultFilename,
  finish,
}: GraphicPickerProps) {
  const [qBook, setQBook] = useState<string | undefined>(undefined);
  const [qRef, setQRef] = useState<string | undefined>(undefined);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [tabValue, setTabValue] = useState(0);
  const userTabRef = useRef(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bibleImagesFromApi, setBibleImagesFromApi] = useState<
    GraphicPickerImage[]
  >([]);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [bibleError, setBibleError] = useState<string | null>(null);

  const [excludedStyles, setExcludedStyles] = useState<string[]>([
    ...DEFAULT_EXCLUDED_STYLES,
  ]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterSortBy, setFilterSortBy] =
    useState<GraphicImageSortBy>('newest');
  const [filterSelectedStyles, setFilterSelectedStyles] = useState<string[]>(
    []
  );
  const [filterSelectedKeywords, setFilterSelectedKeywords] = useState<
    string[]
  >([]);
  const { uploadMedia } = useCompression({
    showMessage,
    dimension,
    defaultFilename,
    finish,
    onOpen,
  });
  const defaultScriptureRefChecked: ScriptureRefChecked = useMemo(
    () => ({ book: true, chapter: true, verse: true }),
    []
  );
  const [filterScriptureRefChecked, setFilterScriptureRefChecked] =
    useState<ScriptureRefChecked>(defaultScriptureRefChecked);
  const { getOrganizedBy } = useOrganizedBy();
  const bookData = useSelector((state: IState) => state.books.bookData);
  const book = useMemo(
    () => bookData.find((b) => b.code === (qBook ?? bookCode)),
    [bookCode, bookData, qBook]
  );
  const [errorReporter] = useGlobal('errorReporter');
  const t: IGraphicStrings = useSelector(graphicStringsSelector, shallowEqual);
  const TAB_BIBLE = t.tabBible;
  const TAB_CUSTOM = t.tabCustom;
  const TAB_CURRENT = t.tabCurrent;

  const { getSearchUrl, getKeywordUrl, getStyleUrl } = useGraphicUrlBuilder(
    qBook ?? bookCode ?? '',
    qRef ?? refString ?? '',
    filterScriptureRefChecked,
    Boolean(qBook),
    setQBook,
    setQRef
  );

  const scriptureReference = useMemo((): ScriptureReferenceFilter | null => {
    return getRefFilter(
      qBook ?? bookCode,
      qRef ?? refString,
      book ?? ({ short: bookCode } as BookName)
    );
  }, [book, bookCode, refString, qBook, qRef]);

  const [filterStyles, setFilterStyles] = useState<string[]>([]);

  useEffect(() => {
    if (!userTabRef.current) {
      if (currentGraphic && tabValue !== 2) {
        setTabValue(2);
      } else if (!currentGraphic && tabValue !== 0) {
        setTabValue(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGraphic]);

  useEffect(() => {
    if (!isOpen || tabValue !== 0) return;
    runBibleFetch({
      getUrl: () => getStyleUrl({ page: 1, limit: 100 }),
      parse: parseStyleResponse,
      onSuccess: (items) =>
        setFilterStyles(
          items.filter((s) => !excludedStyles.includes(s.toLocaleLowerCase()))
        ),
      onFailure: () => setFilterStyles([]),
      setLoading: setBibleLoading,
      setError: setBibleError,
      t,
    });
  }, [isOpen, tabValue, getStyleUrl, excludedStyles, t]);

  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || tabValue !== 0) return;
    runBibleFetch({
      getUrl: () => getKeywordUrl({ page: 1, limit: 100 }),
      parse: parseKeywordResponse,
      onSuccess: (items) => setFilterKeywords(items.map((k) => k.keyword)),
      onFailure: () => setFilterKeywords([]),
      setLoading: setBibleLoading,
      setError: setBibleError,
      t,
    });
  }, [isOpen, tabValue, getKeywordUrl, t]);

  const withoutExcluded = useMemo(
    () =>
      excludedStyles.length !== 0
        ? filterStyles
            .filter((s) => !excludedStyles.includes(s.toLocaleLowerCase()))
            .join(',')
        : undefined,
    [filterStyles, excludedStyles]
  );

  const derivedFilterState: GraphicFilterState = useMemo(() => {
    const s =
      filterSelectedStyles.length > 0
        ? filterSelectedStyles.join(',')
        : withoutExcluded;
    const k =
      filterSelectedKeywords.length > 0
        ? filterSelectedKeywords.join(',')
        : undefined;
    return { s, k };
  }, [filterSelectedStyles, filterSelectedKeywords, withoutExcluded]);

  const filterActive =
    excludedStyles.length > 0 ||
    filterSelectedStyles.length > 0 ||
    filterSelectedKeywords.length > 0 ||
    filterScriptureRefChecked.book ||
    filterScriptureRefChecked.chapter ||
    filterScriptureRefChecked.verse;

  const handleFilterClear = () => {
    setExcludedStyles([]);
    setFilterSelectedStyles([]);
    setFilterSelectedKeywords([]);
    setFilterScriptureRefChecked({ book: false, chapter: false, verse: false });
    setQBook(undefined);
    setQRef(undefined);
    setSearch('');
    setFilterPanelOpen(false);
  };

  const handleFilterResetToDefault = useCallback(() => {
    setExcludedStyles([...DEFAULT_EXCLUDED_STYLES]);
    setFilterSortBy('newest');
    setFilterSelectedStyles([]);
    setFilterSelectedKeywords([]);
    setFilterScriptureRefChecked({ ...defaultScriptureRefChecked });
    setQBook(undefined);
    setQRef(undefined);
    setSearch('');
    setFilterPanelOpen(false);
  }, [defaultScriptureRefChecked]);

  useEffect(() => {
    if (!isOpen || tabValue !== 0) return;
    runBibleFetch({
      getUrl: () =>
        getSearchUrl({
          query: debouncedSearch.trim(),
          filterState: derivedFilterState,
          page: 1,
          limit: 100,
          sortByNewest: filterSortBy === 'newest',
        }),
      parse: parseBibleImageResponse,
      onSuccess: (items) =>
        setBibleImagesFromApi(items.map(bibleImageToPickerImage)),
      onFailure: () => setBibleImagesFromApi([]),
      setLoading: setBibleLoading,
      setError: setBibleError,
      t,
    });
  }, [
    isOpen,
    tabValue,
    debouncedSearch,
    derivedFilterState,
    filterSortBy,
    getSearchUrl,
    t,
  ]);

  const images = useMemo(
    () => (tabValue === 0 ? bibleImagesFromApi : customImages),
    [tabValue, bibleImagesFromApi, customImages]
  );

  const filteredImages = useMemo(() => {
    let q = debouncedSearch.trim().toLowerCase();
    // remove reference prefix from debounced query
    const words = q.split(' ');
    if (qBook) {
      q = words.slice(1).join(' ');
      if (refMatch(words[1]) || chapterMatch(words[1])) {
        q = words.slice(2).join(' ');
      }
    }
    if (!q) return images;
    return images.filter((img) => {
      if ((img.label ?? '').toLowerCase().indexOf(q) !== -1) return true;
      for (const keyword of img.keywords ?? []) {
        if (keyword.toLowerCase().indexOf(q) !== -1) return true;
      }
      for (const style of img.styles ?? []) {
        if (style.toLowerCase().indexOf(q) !== -1) return true;
      }
      return false;
    });
  }, [images, debouncedSearch, qBook]);

  const handleClose = useCallback(() => {
    if (mediaUploadControlsRef?.current?.handleCancel && tabValue === 1) {
      mediaUploadControlsRef.current.handleCancel();
    }
    onOpen(false);
    onCancel?.();
    setSearch('');
    setSelectedId(null);
    userTabRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOpen, onCancel, tabValue]);

  const handleSetGraphic = useCallback(() => {
    userTabRef.current = false;
    if (tabValue === 1) {
      if (mediaUploadControlsRef?.current?.handleAddOrSave) {
        mediaUploadControlsRef.current.handleAddOrSave();
      }
      onOpen(false);
      setSelectedId(null);
      return;
    }

    if (!selectedId) return;
    const img = images.find((i) => i.id === selectedId);
    if (img) {
      if (!img.url) {
        logError(
          Severity.error,
          errorReporter,
          'Error uploading graphic: selected image has no URL'
        );
        onOpen(false);
        setSelectedId(null);
        return;
      }
      const { base, ext } = getUrlNameAndExt(img.url);
      const mimeType = mimeMap[ext.toLowerCase()] || 'image/jpeg';
      urlToFile(img.url, `${base}.${ext}`, mimeType)
        .then((file) => {
          uploadMedia([file]);
        })
        .catch((error: unknown) => {
          logError(
            Severity.error,
            errorReporter,
            `Error uploading graphic: ${error}`
          );
        })
        .finally(() => {
          setSelectedId(null);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue, selectedId, images, onOpen]);

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      userTabRef.current = true;
      setTabValue(newValue);
      setSelectedId(null);
    },
    []
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const canSetGraphic = () =>
    (tabValue === 0 && Boolean(selectedId)) ||
    (tabValue === 1 && !saveDisabled);

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      aria-labelledby="graphic-picker-dialog"
      scroll="paper"
      disableEnforceFocus
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: { minHeight: '60vh', maxHeight: '90vh' },
        },
      }}
    >
      <StyledDialogTitle id="graphic-picker-dialog" onClose={handleClose}>
        {t.title}
      </StyledDialogTitle>
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        aria-label={t.graphicSource}
        sx={{
          px: 2,
          '& .MuiTabs-indicator': {
            backgroundColor: 'primary.main',
            height: 2,
          },
          '& .Mui-selected': { color: 'primary.main' },
        }}
      >
        <Tab
          id="graphic-picker-tab-0"
          label={TAB_BIBLE}
          aria-controls="graphic-picker-tabpanel-0"
        />
        <Tab
          id="graphic-picker-tab-1"
          label={TAB_CUSTOM}
          aria-controls="graphic-picker-tabpanel-1"
        />
        <Tab
          id="graphic-picker-tab-2"
          label={TAB_CURRENT}
          aria-controls="graphic-picker-tabpanel-2"
          disabled={!currentGraphic}
        />
      </Tabs>
      <DialogContent
        sx={{
          px: 2,
          pt: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <TabPanel value={tabValue} index={0}>
            {!(qBook ?? bookCode) || !(qRef ?? refString) ? (
              <Typography color="text.secondary" variant="body2">
                {t.noSelection.replace('{0}', getOrganizedBy(true))}
              </Typography>
            ) : (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1,
                    flexShrink: 0,
                  }}
                >
                  <TextField
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{ flex: 1 }}
                    aria-label={t.graphicSearch}
                  />
                  <GraphicImageFilter
                    open={filterPanelOpen}
                    onOpenChange={setFilterPanelOpen}
                    sortBy={filterSortBy}
                    onSortByChange={setFilterSortBy}
                    styles={filterStyles}
                    selectedStyles={filterSelectedStyles}
                    onStylesChange={setFilterSelectedStyles}
                    keywords={filterKeywords}
                    selectedKeywords={filterSelectedKeywords}
                    onKeywordsChange={setFilterSelectedKeywords}
                    scriptureReference={scriptureReference}
                    scriptureRefChecked={filterScriptureRefChecked}
                    onScriptureRefCheckedChange={setFilterScriptureRefChecked}
                    onClear={handleFilterClear}
                    onResetToDefault={handleFilterResetToDefault}
                    filterActive={filterActive}
                    refOverride={Boolean(qBook)}
                  />
                </Box>
                <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  {bibleLoading ? (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 120,
                      }}
                    >
                      <CircularProgress size={32} />
                    </Box>
                  ) : bibleError ? (
                    <Typography color="error" variant="body2">
                      {bibleError}
                    </Typography>
                  ) : (
                    <Grid container spacing={1}>
                      {filteredImages.map((img) => (
                        <Grid key={img.id} size={{ xs: 6, sm: 4, md: 3 }}>
                          <GraphicGridItem
                            image={img}
                            selected={selectedId === img.id}
                            onSelect={() => handleSelect(img.id)}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              </>
            )}
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <VertScrollBox>
              {metadata ?? (
                <Typography color="text.secondary">
                  Not yet implemented
                </Typography>
              )}
            </VertScrollBox>
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            <VertScrollBox>{currentGraphic ?? <></>}</VertScrollBox>
          </TabPanel>
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          justifyContent: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <AltButton onClick={handleClose}>{ts.cancel ?? 'Cancel'}</AltButton>
        <PriButton onClick={handleSetGraphic} disabled={!canSetGraphic()}>
          {t.setGraphic}
        </PriButton>
      </DialogActions>
    </Dialog>
  );
}

export default GraphicPicker;
