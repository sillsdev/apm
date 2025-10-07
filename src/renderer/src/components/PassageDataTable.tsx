import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  IPassageDetailArtifactsStrings,
  ISharedStrings,
  IState,
} from '../model';
import { ActionRow, AltButton, GrowingSpacer, PriButton } from '../control';
import { shallowEqual, useSelector } from 'react-redux';
import { passageDetailArtifactsSelector, sharedSelector } from '../selector';
import BigDialog from '../hoc/BigDialog';
import {
  Box,
  FormControlLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  SelectProps,
  Stack,
  Switch,
  TextField,
  Typography,
  styled,
} from '@mui/material';
import {
  DataGrid,
  type GridRowSelectionModel,
  type GridColDef,
} from '@mui/x-data-grid';
import BookSelect, { OptionType } from './BookSelect';
import { useGlobal } from '../context/useGlobal';
import { usePlanType } from '../crud';
import usePassageDetailContext from '../context/usePassageDetailContext';
import { ResourceTypeEnum } from './PassageDetail/Internalization/ResourceTypeEnum';
import { RefLevel } from './RefLevel';
import { GridSortItem } from '@mui/x-data-grid/models/gridSortModel';

interface RefOption {
  value: RefLevel;
  label: string;
}

const ReferenceLevel = styled(Select)<SelectProps>(() => ({
  '#ref-level': {
    paddingTop: `8px`,
    paddingBottom: `8px`,
  },
}));

export interface IRRow {
  language: string;
  category: string;
  title: string;
  description: string;
  version: number;
  keywords: string;
  terms: string;
  source: string;
  srid: string;
}

interface IProps {
  isNote?: boolean | undefined;
  data: IRRow[];
  value?: number | undefined;
  bookOpt: OptionType | undefined;
  scope?: ResourceTypeEnum | undefined;
  initFindRef: string;
  onScope?: ((val: ResourceTypeEnum) => void) | undefined;
  termsOfUse: (i: number) => string | undefined;
  onOpen: (val: boolean) => void;
  onSelect?: ((rows: number[]) => void) | undefined;
  onBookCd: (bookCd: string | undefined) => void;
  onFindRef: (findRef: string) => void;
  onRefLevel?: ((refLevel: RefLevel) => void) | undefined;
  levelIn?: RefLevel | undefined;
}

export const PassageDataTable = (props: IProps) => {
  const {
    isNote,
    data,
    value,
    scope,
    initFindRef,
    onScope,
    onOpen,
    onSelect,
    onBookCd,
    onFindRef,
    onRefLevel,
    termsOfUse,
  } = props;
  const [refLevel, setRefLevel] = useState<RefLevel>(RefLevel.Verse);
  const [checks, setChecks] = useState<number[]>([]);
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });
  const [termsCheck, setTermsCheck] = useState<number[]>([]);
  const [curTermsCheck, setCurTermsCheck] = useState<number>();
  const [bookOpt, setBookOpt] = useState<OptionType>();
  const [plan] = useGlobal('plan'); //will be constant here
  const planType = usePlanType();
  const bookSuggestions = useSelector(
    (state: IState) => state.books.suggestions
  );
  const { passage } = usePassageDetailContext();
  const [findRef, setFindRef] = useState(initFindRef);
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const columns: GridColDef<IRRow>[] = !isNote
    ? [
        { field: 'language', headerName: t.language, width: 150 },
        { field: 'category', headerName: t.category, width: 150 },
        {
          field: 'title',
          headerName: t.title,
          width: 200,
          cellClassName: 'warp-text',
        },
        {
          field: 'description',
          headerName: t.description,
          width: 200,
          cellClassName: 'warp-text',
        },
        { field: 'version', headerName: t.version, width: 100 },
        {
          field: 'keywords',
          headerName: t.keywords,
          width: 200,
          cellClassName: 'warp-text',
        },
        { field: 'terms', headerName: t.termsOfUse, width: 100 },
        {
          field: 'source',
          headerName: t.source,
          width: 200,
          cellClassName: 'warp-text',
        },
      ]
    : [
        { field: 'category', headerName: t.category, width: 150 },
        {
          field: 'title',
          headerName: t.title,
          width: 200,
          cellClassName: 'warp-text',
        },
        {
          field: 'description',
          headerName: t.description,
          width: 200,
          cellClassName: 'warp-text',
        },
        {
          field: 'keywords',
          headerName: t.keywords,
          width: 200,
          cellClassName: 'warp-text',
        },
        {
          field: 'source',
          headerName: t.source,
          width: 200,
          cellClassName: 'warp-text',
        },
      ];
  const sortModel: GridSortItem[] = [
    { field: 'language', sort: 'asc' },
    { field: 'category', sort: 'asc' },
    { field: 'title', sort: 'asc' },
  ];
  const referenceLevel: RefOption[] = [
    {
      label: t.verseLevel.replace('{0}', isNote ? t.notes : t.resources),
      value: RefLevel.Verse,
    },
    {
      label: t.chapterLevel.replace('{0}', isNote ? t.notes : t.resources),
      value: RefLevel.Chapter,
    },
    {
      label: t.bookLevel.replace('{0}', isNote ? t.notes : t.resources),
      value: RefLevel.Book,
    },
    {
      label: t.allLevel.replace('{0}', isNote ? t.notes : t.resources),
      value: RefLevel.All,
    },
  ];

  useEffect(() => {
    if (findRef !== initFindRef) setFindRef(initFindRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initFindRef]);

  const isScripture = useMemo(
    () => planType(plan)?.scripture,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]
  );

  useEffect(() => {
    const val = value ?? -1;
    if (
      val >= 0 &&
      val < data.length &&
      checks.findIndex((r) => r === val) < 0
    ) {
      setChecks([val]);
      setSelectedRows({
        type: 'include',
        ids: new Set([val]),
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, data]); //don't add checks

  useEffect(() => {
    setBookOpt(props.bookOpt);
  }, [props.bookOpt]);

  useEffect(() => {
    setRefLevel(props.levelIn ?? RefLevel.Verse);
  }, [props.levelIn]);

  const handleCancel = () => {
    onOpen && onOpen(false);
  };

  const numSort = (i: number, j: number) => i - j;

  const handleRowSelectionChange = (newRows: GridRowSelectionModel) => {
    let chks = Array.from(newRows.ids).map((id) => parseInt(id as string));
    //if we're a note, we want single select so if there are more than one, we take the last one
    if (isNote && chks.length > 1) chks = [chks[chks.length - 1] ?? 0];
    const curLen = checks.length;
    const newLen = chks.length;
    if (isNote || curLen < newLen) {
      const termsList: number[] = [];
      const noTermsList: number[] = [];
      for (const c of chks) {
        if (!checks.includes(c)) {
          if (termsOfUse(c)) {
            termsList.push(c);
          } else {
            noTermsList.push(c);
          }
        }
      }
      if (noTermsList.length > 0) {
        const newChecks = (isNote ? [] : checks)
          .concat(noTermsList)
          .sort(numSort);
        setChecks(newChecks);
        setSelectedRows({
          type: 'include',
          ids: new Set(newChecks),
        });
      }
      if (termsList.length > 0) {
        setTermsCheck(termsList);
        setCurTermsCheck(termsList[0]);
      }
    } else if (curLen > newLen) {
      setChecks(chks);
      setSelectedRows({
        type: 'include',
        ids: new Set(chks),
      });
    }
  };

  const handleTermsCancel = () => {
    setTermsCheck([]);
    setCurTermsCheck(undefined);
  };

  const handleTermsReject = () => {
    const updatedTermsCheck = termsCheck.filter((t) => t !== curTermsCheck);
    setTermsCheck(updatedTermsCheck);
    if (updatedTermsCheck.length === 0) {
      handleTermsCancel();
    } else {
      setCurTermsCheck(updatedTermsCheck[0]);
    }
  };

  const handleTermsAccept = () => {
    //note is single select so we can just replace the check
    if (curTermsCheck !== undefined) {
      const newChecks = (isNote ? [] : checks).concat([curTermsCheck]);
      setChecks(newChecks);
      setSelectedRows({
        type: 'include',
        ids: new Set(newChecks),
      });
    }
    handleTermsReject();
  };

  const handleBookCommit = (newValue: string) => {
    onBookCd(newValue);
    const newOpt = bookSuggestions.find((v) => v.value === newValue);
    setBookOpt(newOpt);
  };
  const handleBookRevert = () => {
    onBookCd(undefined);
  };
  const handlePreventSave = () => {};

  const handleFindRefChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFindRef(event.target.value);
    onFindRef(event.target.value);
  };

  const handleLevelChange = (event: SelectChangeEvent<RefLevel>) => {
    setRefLevel(event.target.value as RefLevel);
    onRefLevel && onRefLevel(event.target.value as RefLevel);
  };

  const handleLink = useCallback(() => {
    if (onSelect) {
      onSelect(checks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checks]);

  const handleScopeToggle = () => {
    onScope &&
      onScope(
        scope === ResourceTypeEnum.passageResource
          ? ResourceTypeEnum.sectionResource
          : ResourceTypeEnum.passageResource
      );
  };
  return (
    <div id="passage-data-table">
      {isScripture && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', my: 1 }}>
          {onScope && (
            <FormControlLabel
              control={
                <Switch
                  value={scope === ResourceTypeEnum.passageResource}
                  onClick={handleScopeToggle}
                />
              }
              label={t.passageResource}
            />
          )}
          <GrowingSpacer />
          {refLevel !== RefLevel.All && (
            <>
              <Box sx={{ width: '200px' }}>
                <BookSelect
                  placeHolder={t.selectBook}
                  suggestions={bookSuggestions}
                  value={bookOpt}
                  autoFocus={false}
                  onCommit={handleBookCommit}
                  onRevert={handleBookRevert}
                  setPreventSave={handlePreventSave}
                />
              </Box>
              {refLevel !== RefLevel.Book && (
                <TextField
                  id="find-refs"
                  variant="outlined"
                  value={findRef}
                  onChange={handleFindRefChange}
                  slotProps={{
                    input: {
                      sx: { py: 1 },
                      placeholder: passage?.attributes.reference ?? t.reference,
                    },
                  }}
                  sx={{ width: '400px' }}
                />
              )}
            </>
          )}
          {onRefLevel && (
            <ReferenceLevel
              id="ref-level"
              value={refLevel ?? RefLevel.All}
              onChange={handleLevelChange as any}
              sx={{ width: '325px' }}
              inputProps={{ autoFocus: true }}
            >
              {referenceLevel.map((rl) => (
                <MenuItem key={rl.value} value={rl.value}>
                  {rl.label}
                </MenuItem>
              ))}
            </ReferenceLevel>
          )}
        </Stack>
      )}
      <DataGrid
        columns={columns}
        rows={data.map((r, i) => ({ ...r, id: i }))}
        initialState={{
          sorting: { sortModel },
        }}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={selectedRows}
        onRowSelectionModelChange={handleRowSelectionChange}
        sx={{
          '& .wrap-text': {
            whiteSpace: 'break-spaces',
            lineHeight: '1.2',
          },
        }}
      />
      <ActionRow>
        <AltButton id="res-select-cancel" onClick={handleCancel}>
          {ts.cancel}
        </AltButton>
        <PriButton
          id="res-selected"
          onClick={handleLink}
          disabled={checks.length === 0 || termsCheck.length > 0}
        >
          {t.link}
        </PriButton>
      </ActionRow>
      {curTermsCheck !== undefined && (
        <BigDialog
          title={t.termsReview}
          description={
            <Typography sx={{ pb: 2 }}>
              {t.titleDesc.replace('{0}', (data[curTermsCheck] as IRRow).title)}
            </Typography>
          }
          isOpen={termsCheck !== undefined}
          onOpen={handleTermsCancel}
        >
          <>
            <Typography>{termsOfUse(curTermsCheck)}</Typography>
            <ActionRow>
              <AltButton id="terms-cancel" onClick={handleTermsReject}>
                {ts.cancel}
              </AltButton>
              <PriButton id="terms-accept" onClick={handleTermsAccept}>
                {t.accept}
              </PriButton>
            </ActionRow>
          </>
        </BigDialog>
      )}
    </div>
  );
};

export default PassageDataTable;
