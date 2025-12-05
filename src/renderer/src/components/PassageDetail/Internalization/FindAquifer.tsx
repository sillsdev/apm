import {
  Autocomplete,
  Grid,
  IconButton,
  InputAdornment,
  OutlinedInput,
  Stack,
  styled,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PreviewIcon from '@mui/icons-material/Visibility';
import LinkIcon from '@mui/icons-material/Link';
import { useContext, useEffect, useRef, useState } from 'react';
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
import { LightTooltip, PriButton } from '../../StepEditor';
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
  useWaitForRemoteQueue,
} from '../../../utils';
import BigDialog from '../../../hoc/BigDialog';
import { Aquifer } from '../../../assets/brands';
import { useSnackBar } from '../../../hoc/SnackBar';
import { AxiosError } from 'axios';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { PassageTypeEnum } from '../../../model/passageType';
import {
  DataGrid,
  type GridRenderCellParams,
  type GridColDef,
  type GridRowSelectionModel,
  type GridSortModel,
} from '@mui/x-data-grid';

type GridSortItem = GridSortModel[number];
import ArrowLeftIcon from '@mui/icons-material/ArrowBack';
import ArrowRightIcon from '@mui/icons-material/ArrowForward';

// Regex to match passage references in the form "chapter:verse-chapter:verse"
const PASSAGE_REF_REGEX = /(\d+):(\d+)-(\d+)?:?(\d+)?/g;

const StyledStack = styled(Stack)(() => ({
  '& .MuiDataGrid-footerContainer': {
    display: 'none!important',
  },
}));

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

interface DataRow {
  id: number;
  select: boolean;
  name: string;
  mediaType: string;
  group: string;
  source: string;
}

interface IProps {
  onClose?: (() => void) | undefined;
}

export default function FindAquifer({ onClose }: IProps) {
  const { passage, section } = usePassageDetailContext();
  const { InternalizationStep } = useSecResCreate(section);
  const [isOffline] = useGlobal('offline');
  const [offlineOnly] = useGlobal('offlineOnly');
  const [memory] = useGlobal('memory');
  const [result, setResult] = useState<AquiferSearch[]>([]);
  const [data, setData] = useState<DataRow[]>([]);
  const [checks, setChecks] = useState<number[]>([]);
  const [count, setCount] = useState(0);
  const [languages, setLanguages] = useState<AquiferLanguage[]>([]);
  const [langOpts, setLangOpts] = useState<OptionProps[]>([]);
  const [lang, setLang] = useState<OptionProps | null>(null);
  const [query, setQuery] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [previewItem, setPreviewItem] = useState<DataRow | null>(null);
  const [content, setContent] = useState<AquiferContent | null>(null);
  const [link, setLink] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [adding, setAddingx] = useState(false);
  const addingRef = useRef(false);
  const t: IFindResourceStrings = useSelector(
    findResourceSelector,
    shallowEqual
  );
  const tg: IGridStrings = useSelector(gridSelector, shallowEqual);
  const token = useContext(TokenContext).state.accessToken ?? '';
  const [limit] = useState(100); // TODO: always loads max of 100 results?
  const [offset, setOffset] = useState(0);
  const forceDataChanges = useDataChanges();
  const waitForDataChangesQueue = useWaitForRemoteQueue('datachanges');
  const { userIsAdmin } = useRole();
  const handlePreviewClick = (e: React.MouseEvent, row: DataRow) => {
    e.stopPropagation();
    setPreviewItem(row);
  };
  const { showMessage } = useSnackBar();
  const [errorReporter] = useGlobal('errorReporter');
  const { curNoteRef } = useNotes();

  const columns: GridColDef<DataRow>[] = [
    {
      field: 'name',
      headerName: t.name,
      width: 200,
      cellClassName: 'wrap-text',
    },
    { field: 'mediaType', headerName: t.mediaType, width: 100 },
    {
      field: 'group',
      headerName: t.group,
      width: 120,
      cellClassName: 'wrap-text',
    },
    {
      field: 'source',
      headerName: t.source,
      width: 200,
      cellClassName: 'wrap-text',
    },
    {
      field: 'preview',
      headerName: t.preview,
      width: 100,
      filterable: false,
      sortable: false,
      renderCell: (params: GridRenderCellParams<DataRow>) => (
        <IconButton onClick={(e) => handlePreviewClick(e, params.row)}>
          <PreviewIcon />
        </IconButton>
      ),
    },
  ];
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });
  const sortModel: GridSortItem[] = [{ field: 'name', sort: 'asc' }];

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

    axiosGet('aquifer/aquifer-search', searchParams, token).then((result) => {
      const response = result as {
        totalItemCount: number;
        items: AquiferSearch[];
      };
      setCount(response?.totalItemCount ?? 0);
      setResult(response?.items ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage, lang, refresh, offset]);

  useEffect(() => {
    const dataRows = result.map((item: AquiferSearch) => ({
      id: item.id,
      select: false,
      name: item.localizedName,
      mediaType: item.mediaType,
      group: item.grouping?.type,
      source: item.grouping.name,
    }));
    setData(dataRows);
  }, [result]);

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

  const handleRowSelectionChange = (newRows: GridRowSelectionModel) => {
    let chks = Array.from(newRows.ids)
      .map((id) => parseInt(id as string))
      .sort();
    if (newRows.type === 'exclude') {
      chks = [];
      data.forEach((r) => {
        if (!newRows.ids.has(r.id)) chks.push(r.id);
      });
    }
    setChecks(chks);
    setSelectedRows(newRows);
  };

  const handleAdd = () => {
    if (addingRef.current) return;
    setAdding(true);
    const add: { ContentId: string; ContentType: string }[] = [];
    checks.forEach((c) => {
      const item = data.find((d) => d.id === c);
      if (item) {
        add.push({
          ContentId: item.id.toString(),
          ContentType:
            item.mediaType.toLowerCase() === 'text' ? 'Markdown' : '0',
        });
      }
    });
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
        showMessage(t.addError + (err as AxiosError).message);
        logError(Severity.error, errorReporter, infoMsg(err, t.addError));
      });
  };

  return (
    <Grid
      container
      spacing={2}
      sx={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <StyledStack>
        <Grid
          container
          direction={'row'}
          spacing={2}
          sx={{ my: 1, alignItems: 'center' }}
        >
          <Grid>
            <Autocomplete
              disablePortal
              id="aquifer-lang"
              options={langOpts}
              value={lang}
              onChange={(_event, value) => setLang(value)}
              sx={{ width: 300 }}
              renderInput={(params) => {
                const { size, InputLabelProps, ...restParams } = params;
                const { className, ...restInputLabelProps } =
                  InputLabelProps || {};
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
          </Grid>
          <Grid>
            {offset === 0 && (
              <LightTooltip title={t.aquiferSearchTip}>
                <OutlinedInput
                  id="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
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
          </Grid>
          {userIsAdmin && (!isOffline || offlineOnly) && (
            <Grid>
              <PriButton
                onClick={handleAdd}
                disabled={checks.length === 0 || adding}
              >
                {t.add}
              </PriButton>
            </Grid>
          )}
        </Grid>
        {content && (
          <BigDialog
            title={t.preview}
            description={
              <Typography sx={{ pb: 2 }}>{previewItem?.name}</Typography>
            }
            isOpen={previewOpen}
            onOpen={(isOpen: boolean) => {
              setPreviewOpen(isOpen);
              if (!isOpen) setPreviewItem(null);
            }}
          >
            <>
              {previewItem?.mediaType.toLowerCase() === 'text' ? (
                <Markdown>{(content.content as string[])[0]}</Markdown>
              ) : previewItem?.mediaType.toLowerCase() === 'image' ? (
                <img
                  src={(content.content as any)?.url}
                  alt={previewItem?.name}
                />
              ) : previewItem?.mediaType.toLowerCase() === 'audio' ? (
                <IconButton
                  onClick={() => setLink((content.content as any)?.mp3.url)}
                >
                  <LinkIcon />
                </IconButton>
              ) : (
                <IconButton
                  onClick={() => setLink((content.content as any)?.url)}
                >
                  <LinkIcon />
                </IconButton>
              )}
            </>
          </BigDialog>
        )}
        {count > 0 && (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            {offset > 0 ? (
              <IconButton
                onClick={() => setOffset(offset - limit)}
                title={t.previous}
              >
                <ArrowLeftIcon />
              </IconButton>
            ) : (
              <></>
            )}
            <Typography variant="h6" component="h6">
              {t.showing
                .replace('{0}', `${offset + 1}`)
                .replace('{1}', `${Math.min(offset + limit, count)}`)
                .replace('{2}', `${count}`)
                .replace('{3}', Aquifer)}
            </Typography>
            {offset + limit < count ? (
              <IconButton
                onClick={() => setOffset(offset + limit)}
                title={t.next}
              >
                <ArrowRightIcon />
              </IconButton>
            ) : (
              <></>
            )}
          </Stack>
        )}
        {data.length > 0 ? (
          <DataGrid
            columns={columns}
            rows={data}
            initialState={{
              sorting: { sortModel },
            }}
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={handleRowSelectionChange}
            rowSelectionModel={selectedRows}
          />
        ) : (
          <Grid
            container
            sx={{ my: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Grid>
              <Typography variant="h6">{tg.noData}</Typography>
            </Grid>
          </Grid>
        )}
      </StyledStack>
      <LaunchLink url={link} reset={() => setLink('')} />
    </Grid>
  );
}
