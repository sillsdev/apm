import {
  Autocomplete,
  Box,
  Checkbox,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  OutlinedInput,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PreviewIcon from '@mui/icons-material/Visibility';
import LinkIcon from '@mui/icons-material/Link';
import SortIcon from '@mui/icons-material/Sort';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import {
  memo,
  MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import {
  parseRef,
  remoteIdNum,
  useNotes,
  useRole,
  useSecResCreate,
} from '../../../crud';
import { shallowEqual, useSelector } from 'react-redux';
import { findResourceSelector, gridSelector } from '../../../selector';
import { IFindResourceStrings, IGridStrings } from '../../../model';
import {
  LightTooltip,
  Button,
  StyledMenu,
  StyledMenuItem,
} from '../../../control';
import { OptionProps } from './FindTabs';
import Markdown from 'react-markdown';
import { LaunchLink } from '../../../control/LaunchLink';
import { axiosGet, axiosPost } from '../../../utils/axios';
import { TokenContext } from '../../../context/TokenProvider';
import { useGlobal } from '../../../context/useGlobal';
import { RecordKeyMap } from '@orbit/records';
import {
  infoMsg,
  logError,
  Severity,
  useDataChanges,
  useMobile,
  useWaitForRemoteQueue,
} from '../../../utils';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import Busy from '../../Busy';
import { Aquifer } from '../../../assets/brands';
import { useSnackBar } from '../../../hoc/SnackBar';
import { AxiosError } from 'axios';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { PassageTypeEnum } from '../../../model/passageType';
import ArrowLeftIcon from '@mui/icons-material/ArrowBack';
import ArrowRightIcon from '@mui/icons-material/ArrowForward';

// Regex to match passage references in the form "chapter:verse-chapter:verse"
const PASSAGE_REF_REGEX = /(\d+):(\d+)-(\d+)?:?(\d+)?/g;

interface AquiferSearch {
  id: number;
  name: string;
  localizedName: string;
  mediaType: string;
  languageCode: string;
  grouping: {
    type: string;
    name: string;
    collectionTitle: string;
    collectionCode: string;
  };
}

interface AquiferLanguage {
  id: number;
  code: string;
  englishDisplay: string;
  localizedDisplay: string;
  scriptDirection: string;
}

interface LicenseByLang {
  [key: string]: {
    name: string;
    url: string;
  };
}

export interface AquiferContent {
  id: number;
  name: string;
  localizedName: string;
  content: string[] | { url: string };
  language: {
    id: number;
    code: string;
    displayName: string;
    scriptDirection: number;
  };
  grouping: {
    name: string;
    type: string;
    mediaType: string;
    licenseInfo: {
      title: string;
      copyright: {
        dates: string;
        holder: {
          name: string;
          url: string;
        };
      };
      licenses: LicenseByLang[];
      showAdaptationNoticeForEnglish: boolean;
      showAdaptationNoticeForNonEnglish: boolean;
    };
  };
}

type SortKey = 'name' | 'mediaType' | 'groupingType' | 'groupingName';

interface ISort {
  key: SortKey;
  asc: boolean;
}

const sortAccessor: Record<SortKey, (d: AquiferSearch) => string | undefined> = {
  name: (d) => d.localizedName,
  mediaType: (d) => d.mediaType,
  groupingType: (d) => d.grouping?.type,
  groupingName: (d) => d.grouping?.name,
};

const sortValue = (d: AquiferSearch, key: SortKey): string =>
  sortAccessor[key](d) ?? '';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

interface IAquiferRowProps {
  item: AquiferSearch;
  checked: boolean;
  previewLabel: string;
  onToggle: (id: number) => void;
  onPreview: (item: AquiferSearch) => void;
}

const AquiferRow = memo(function AquiferRow({
  item,
  checked,
  previewLabel,
  onToggle,
  onPreview,
}: IAquiferRowProps) {
  return (
    <ListItem
      disablePadding
      divider
      secondaryAction={
        <LightTooltip title={previewLabel}>
          <IconButton
            edge="end"
            size="small"
            aria-label={previewLabel}
            onClick={() => onPreview(item)}
          >
            <PreviewIcon fontSize="small" />
          </IconButton>
        </LightTooltip>
      }
    >
      <ListItemButton
        dense
        role={undefined}
        onClick={() => onToggle(item.id)}
        sx={{ py: 0.25, pr: 6 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Checkbox
            edge="start"
            size="small"
            tabIndex={-1}
            disableRipple
            checked={checked}
            aria-label={item.localizedName}
          />
        </ListItemIcon>
        <ListItemText
          primary={item.localizedName}
          secondary={[item.mediaType, item.grouping?.type, item.grouping?.name]
            .filter(Boolean)
            .join(' · ')}
          slotProps={{
            primary: {
              variant: 'body2',
              sx: { overflowWrap: 'anywhere' },
            },
            secondary: { variant: 'caption', noWrap: true },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
});

interface IProps {
  onClose?: (() => void) | undefined;
}

export default function FindAquifer({ onClose }: IProps) {
  const { passage, section } = usePassageDetailContext();
  const { InternalizationStep } = useSecResCreate(section);
  const [isOffline] = useGlobal('offline');
  const [offlineOnly] = useGlobal('offlineOnly');
  const [memory] = useGlobal('memory');
  const [data, setData] = useState<AquiferSearch[]>([]);
  const [checks, setChecks] = useState<Set<number>>(() => new Set());
  const [count, setCount] = useState(0);
  const [languages, setLanguages] = useState<AquiferLanguage[]>([]);
  const [langOpts, setLangOpts] = useState<OptionProps[]>([]);
  const [lang, setLang] = useState<OptionProps | null>(null);
  const [query, setQuery] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [previewItem, setPreviewItem] = useState<AquiferSearch | null>(null);
  const [content, setContent] = useState<AquiferContent | null>(null);
  const [link, setLink] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAddingx] = useState(false);
  const addingRef = useRef(false);
  const t: IFindResourceStrings = useSelector(
    findResourceSelector,
    shallowEqual
  );
  const tg: IGridStrings = useSelector(gridSelector, shallowEqual);
  const token = useContext(TokenContext)?.state?.accessToken ?? '';
  const [limit] = useState(100); // TODO: always loads max of 100 results?
  const [offset, setOffset] = useState(0);
  const forceDataChanges = useDataChanges();
  const waitForDataChangesQueue = useWaitForRemoteQueue('datachanges');
  const { userIsAdmin } = useRole();
  const handlePreviewClick = useCallback(
    (item: AquiferSearch) => setPreviewItem(item),
    []
  );
  const { showMessage } = useSnackBar();
  const [errorReporter] = useGlobal('errorReporter');
  const { curNoteRef } = useNotes();
  const { isMobileWidth } = useMobile();

  const [sort, setSort] = useState<ISort | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  const allChecked = data.length > 0 && checks.size === data.length;
  const someChecked = checks.size > 0 && !allChecked;

  const sorted = useMemo(() => {
    if (!sort) return data;
    const dir = sort.asc ? 1 : -1;
    const { key } = sort;
    return [...data].sort(
      (a, b) => dir * collator.compare(sortValue(a, key), sortValue(b, key))
    );
  }, [data, sort]);

  const handleSort = useCallback(
    (key: SortKey) => (e: MouseEvent) => {
      e.stopPropagation();
      setSort((prev) =>
        prev?.key === key ? { key, asc: !prev.asc } : { key, asc: true }
      );
    },
    []
  );

  const sortRows: { key: SortKey; label: string }[] = useMemo(
    () => [
      { key: 'name', label: t.sortName },
      { key: 'mediaType', label: t.sortMediaType },
      { key: 'groupingType', label: t.sortGroupingType },
      { key: 'groupingName', label: t.sortGroupingName },
    ],
    [t]
  );

  const toggleRow = useCallback(
    (id: number) =>
      setChecks((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    []
  );

  const toggleAll = () =>
    setChecks(allChecked ? new Set() : new Set(data.map((d) => d.id)));

  const setAdding = (adding: boolean) => {
    setAddingx(adding);
    addingRef.current = adding;
  };

  useEffect(() => {
    if ((token ?? '') !== '')
      axiosGet('aquifer/languages', undefined, token).then((result) => {
        const response = result as AquiferLanguage[];
        setLanguages(response);
      });
  }, [token]);

  useEffect(() => {
    if (languages) {
      const langOptions = languages.map((item: AquiferLanguage) => ({
        value: item.code,
        label:
          `${item.localizedDisplay}` +
          (item.localizedDisplay !== item.englishDisplay
            ? ` (${item.englishDisplay})`
            : ''),
      }));
      setLangOpts(langOptions);
      setLang(langOptions.find((o) => o.value === 'eng') ?? null);
    }
  }, [languages]);

  useEffect(() => {
    if (lang === null) return;
    const pt = passageTypeFromRef(passage?.attributes?.reference);
    if (pt === PassageTypeEnum.NOTE) {
      // Handle note-specific logic here
      const refs = curNoteRef(passage);
      const m = PASSAGE_REF_REGEX.exec(refs);
      if (m) {
        passage.attributes.startChapter = parseInt(m[1] || '1', 10);
        passage.attributes.startVerse = parseInt(m[2] || '1', 10);
        passage.attributes.endChapter = parseInt(
          m[4] ? m[3] || '1' : m[1] || '1',
          10
        );
        passage.attributes.endVerse = parseInt(
          m[4] ? m[4] : (m[3] ?? (m[2] || '1')),
          10
        );
      }
    } else {
      parseRef(passage);
    }
    const { book, startChapter, startVerse, endChapter, endVerse } =
      passage.attributes;
    const paramArr = [
      ['bookCode', book || 'MAT'],
      ['languageCode', lang?.value || 'eng'],
      ['limit', limit.toString()],
      ['offset', offset.toString()],
    ];
    if (startChapter) paramArr.push(['startChapter', startChapter.toString()]);
    if (startVerse) paramArr.push(['startVerse', startVerse.toString()]);
    if (endChapter) paramArr.push(['endChapter', endChapter.toString()]);
    if (endVerse) paramArr.push(['endVerse', endVerse.toString()]);

    if (query) {
      paramArr.push(['query', query]);
    }
    const searchParams = new URLSearchParams(paramArr);

    let cancelled = false;
    setLoading(true);
    axiosGet('aquifer/aquifer-search', searchParams, token)
      .then((result) => {
        if (cancelled) return;
        const response = result as {
          totalItemCount: number;
          items: AquiferSearch[];
        };
        setCount(response?.totalItemCount ?? 0);
        setData(response?.items ?? []);
        setChecks(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage, lang, refresh, offset]);

  useEffect(() => {
    if (previewItem) {
      const paramArr = [
        ['contentId', previewItem.id.toString()],
        [
          'contentTextType',
          previewItem.mediaType.toLowerCase() === 'text' ? 'Markdown' : '0',
        ],
      ];
      const searchParams = new URLSearchParams(paramArr);
      axiosGet(
        `aquifer/content/${previewItem.id.toString()}`,
        searchParams,
        token
      ).then((result) => {
        const response = result as AquiferContent;
        setContent(response);
        setPreviewOpen(true);
      });
    }
  }, [previewItem, token]);

  const handleAdd = () => {
    if (addingRef.current) return;
    setAdding(true);
    const add = data
      .filter((d) => checks.has(d.id))
      .map((item) => ({
        ContentId: item.id.toString(),
        ContentType: item.mediaType.toLowerCase() === 'text' ? 'Markdown' : '0',
      }));
    const postdata: {
      PassageId?: number;
      SectionId?: number;
      OrgWorkflowStep: number;
      Items: { ContentId: string; ContentType: string }[];
    } = {
      PassageId: remoteIdNum(
        'passage',
        passage.id,
        memory?.keyMap as RecordKeyMap
      ),
      SectionId: remoteIdNum(
        'section',
        section.id,
        memory?.keyMap as RecordKeyMap
      ),
      OrgWorkflowStep: remoteIdNum(
        'orgworkflowstep',
        InternalizationStep()?.id ?? '',
        memory?.keyMap as RecordKeyMap
      ),
      Items: add,
    };
    axiosPost('aquifer', postdata, token)
      .then(() => {
        //could process response as ChangeList but this is easier
        forceDataChanges().then(() => {
          waitForDataChangesQueue('aquifer resource added').then(() => {
            setAdding(false);
            onClose && onClose();
          });
        });
      })
      .catch((err) => {
        setAdding(false);
        showMessage(t.addError + (err as AxiosError).message);
        logError(Severity.error, errorReporter, infoMsg(err, t.addError));
      });
  };

  const previewDialog = content && (
    <BigDialog
      title={t.preview}
      description={
        <Typography sx={{ pb: isMobileWidth ? 1 : 2 }}>
          {previewItem?.localizedName}
        </Typography>
      }
      isOpen={previewOpen}
      onOpen={(isOpen: boolean) => {
        setPreviewOpen(isOpen);
        if (!isOpen) setPreviewItem(null);
      }}
      bp={isMobileWidth ? BigDialogBp.mobile : BigDialogBp.sm}
      mobileNoHorizontalScroll
      mobilePaperWidth="min(720px, calc(100vw - 4px))"
      dialogContentSx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        p: isMobileWidth ? 1 : 2,
        '& img': {
          maxWidth: '100%',
          height: 'auto',
        },
        '& pre': {
          overflowX: 'auto',
          maxWidth: '100%',
        },
        '& *': {
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        },
      }}
    >
      <>
        {previewItem?.mediaType.toLowerCase() === 'text' ? (
          <Box sx={{ width: '100%' }}>
            <Markdown>{(content.content as string[])[0]}</Markdown>
          </Box>
        ) : previewItem?.mediaType.toLowerCase() === 'image' ? (
          <Box sx={{ width: '100%' }}>
            <img
              src={(content.content as any)?.url}
              alt={previewItem?.localizedName}
            />
          </Box>
        ) : previewItem?.mediaType.toLowerCase() === 'audio' ? (
          <IconButton
            onClick={() => setLink((content.content as any)?.mp3.url)}
          >
            <LinkIcon />
          </IconButton>
        ) : (
          <IconButton onClick={() => setLink((content.content as any)?.url)}>
            <LinkIcon />
          </IconButton>
        )}
      </>
    </BigDialog>
  );

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        width: '100%',
      }}
    >
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: (theme) => theme.zIndex.drawer + 1,
          }}
        >
          <Busy />
        </Box>
      )}

      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1}
        alignItems="center"
        sx={{ flexShrink: 0, py: 1, px: 0.5 }}
        useFlexGap
      >
        <Autocomplete
          disablePortal
          id="aquifer-lang"
          options={langOpts}
          value={lang}
          onChange={(_event, value) => setLang(value)}
          sx={{ flex: '1 1 220px', minWidth: 0, maxWidth: '100%' }}
          renderInput={(params) => {
            const { size, InputLabelProps, ...restParams } = params;
            const { className, ...restInputLabelProps } = InputLabelProps || {};
            return (
              <TextField
                {...restParams}
                {...(size && { size })}
                slotProps={{
                  inputLabel: {
                    ...restInputLabelProps,
                    ...(className && { className }),
                  },
                }}
                label={t.language.replace('{0}', Aquifer)}
              />
            );
          }}
        />
        {offset === 0 && (
          <LightTooltip title={t.aquiferSearchTip}>
            <OutlinedInput
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ flex: '1 1 200px', minWidth: 0 }}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    type="submit"
                    onClick={() => setRefresh(refresh + 1)}
                  >
                    <SearchIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      setQuery('');
                      setRefresh(refresh + 1);
                    }}
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              }
              inputProps={{
                'aria-label': 'query',
              }}
            />
          </LightTooltip>
        )}
      </Stack>

      {data.length > 0 ? (
        <>
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              flexShrink: 0,
              px: 1,
              py: 0.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Checkbox
              size="small"
              checked={allChecked}
              indeterminate={someChecked}
              onChange={toggleAll}
              aria-label={tg.all}
            />
            <Typography variant="body2" color="text.secondary">
              {tg.all}
            </Typography>
            <LightTooltip title={t.sortMenu}>
              <IconButton
                id="aquifer-sort"
                size="small"
                aria-controls={sortAnchor ? 'aquifer-sort-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={sortAnchor ? 'true' : undefined}
                aria-label={t.sortMenu}
                onClick={(e) => setSortAnchor(e.currentTarget)}
                sx={{ ml: 'auto' }}
              >
                <SortIcon fontSize="small" />
              </IconButton>
            </LightTooltip>
            <StyledMenu
              id="aquifer-sort-menu"
              anchorEl={sortAnchor}
              open={Boolean(sortAnchor)}
              onClose={() => setSortAnchor(null)}
            >
              {sortRows.map(({ key, label }) => (
                <StyledMenuItem
                  key={key}
                  id={`aquifer-sort-${key}`}
                  onClick={handleSort(key)}
                  selected={sort?.key === key}
                >
                  <ListItemIcon>
                    {sort?.key === key ? (
                      sort.asc ? (
                        <ArrowUpwardIcon fontSize="small" />
                      ) : (
                        <ArrowDownwardIcon fontSize="small" />
                      )
                    ) : null}
                  </ListItemIcon>
                  <ListItemText primary={label} />
                </StyledMenuItem>
              ))}
            </StyledMenu>
          </Stack>
          <List
            dense
            disablePadding
            sx={{
              flex: '1 1 auto',
              minHeight: 0,
              overflowY: 'auto',
              px: 0.5,
              maxHeight: isMobileWidth ? 'none' : '55vh',
            }}
          >
            {sorted.map((item) => (
              <AquiferRow
                key={item.id}
                item={item}
                checked={checks.has(item.id)}
                previewLabel={t.preview}
                onToggle={toggleRow}
                onPreview={handlePreviewClick}
              />
            ))}
          </List>
        </>
      ) : (
        <Box
          sx={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
          }}
        >
          {!loading && <Typography variant="h6">{tg.noData}</Typography>}
        </Box>
      )}

      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1}
        alignItems="center"
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          py: 1,
          px: 0.5,
        }}
        useFlexGap
      >
        {count > 0 ? (
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            sx={{ minWidth: 0 }}
            useFlexGap
          >
            <IconButton
              size="small"
              onClick={() => setOffset(offset - limit)}
              disabled={offset === 0}
              title={t.previous}
              aria-label={t.previous}
            >
              <ArrowLeftIcon />
            </IconButton>
            <Typography
              variant="body2"
              component="span"
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t.showing
                .replace('{0}', `${offset + 1}`)
                .replace('{1}', `${Math.min(offset + limit, count)}`)
                .replace('{2}', `${count}`)}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= count}
              title={t.next}
              aria-label={t.next}
            >
              <ArrowRightIcon />
            </IconButton>
          </Stack>
        ) : null}
        {userIsAdmin && (!isOffline || offlineOnly) && (
          <Button
            sx={{ flex: '0 1 auto', ml: 'auto' }}
            color="primary"
            disabled={checks.size === 0 || adding}
            onClick={handleAdd}
          >
            {t.add}
          </Button>
        )}
      </Stack>

      {previewDialog}
      <LaunchLink url={link} reset={() => setLink('')} />
    </Box>
  );
}
