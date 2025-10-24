import { useState, useEffect, useMemo } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import { useSelector, shallowEqual } from 'react-redux';
import { passageDetailArtifactsSelector } from '../../../selector';
import {
  IState,
  Passage,
  PassageD,
  Section,
  SectionD,
  Plan,
  BookName,
  IPassageDetailArtifactsStrings,
  ISharedStrings,
  SectionArray,
} from '../../../model';
import {
  Box,
  Button,
  debounce,
  Paper,
  PaperProps,
  styled,
  Typography,
} from '@mui/material';
import {
  related,
  sectionNumber,
  sectionCompare,
  passageCompare,
  passageDescText,
  useOrganizedBy,
  findRecord,
  usePlanType,
  sectionRef,
} from '../../../crud';
import { sharedSelector } from '../../../selector';
import { eqSet } from '../../../utils';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { PassageTypeEnum } from '../../../model/passageType';
import { RecordIdentity } from '@orbit/records';
import { useOrbitData } from '../../../hoc/useOrbitData';
import {
  projDefSectionMap,
  useProjectDefaults,
} from '../../../crud/useProjectDefaults';
import {
  GridColDef,
  GridRowSelectionModel,
  GridSortModel,
} from '@mui/x-data-grid';
import { TreeDataGrid } from '../../../components/TreeDataGrid';

const StyledPaper = styled(Paper)<PaperProps>(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  marginBottom: theme.spacing(1),
  '& .MuiPaper-rounded': {
    borderRadius: '8px',
  },
  overflow: 'auto',
  paddingTop: theme.spacing(2),
}));

interface IRow {
  id: number;
  recId: string;
  name: string;
  passages: string;
  parentId: string;
}

/* build the section name = sequence + name */
const getSection = (
  section: Section,
  passages: Passage[],
  sectionMap: Map<number, string>,
  bookData: BookName[]
) => {
  const name =
    sectionRef(section, passages, bookData) ?? section?.attributes?.name ?? '';
  return sectionNumber(section, sectionMap) + '.\u00A0\u00A0' + name;
};

/* build the passage name = sequence + book + reference */
const getReference = (passage: Passage, bookData: BookName[] = []) => {
  return passageDescText(passage, bookData);
};

interface IProps {
  title: string;
  visual?: boolean;
  onSelect?: (items: RecordIdentity[]) => void;
}

export function SelectSections(props: IProps) {
  const { visual, title, onSelect } = props;
  const passages = useOrbitData<PassageD[]>('passage');
  const sections = useOrbitData<SectionD[]>('section');
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan'); //will be constant here
  const [data, setData] = useState(Array<IRow>());
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [heightStyle, setHeightStyle] = useState({
    maxHeight: `${window.innerHeight - 250}px`,
  });
  const { getOrganizedBy } = useOrganizedBy();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const ta: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const [buttonText, setButtonText] = useState(ta.projectResourceConfigure);
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const [columns, setColumns] = useState<GridColDef[]>([]);
  const [checks, setChecks] = useState<Array<string | number>>([]);
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });
  const { getProjectDefault } = useProjectDefaults();
  const sectionMap = new Map<number, string>(
    (getProjectDefault(projDefSectionMap) ?? []) as SectionArray
  );
  const setDimensions = () => {
    setHeightStyle({
      maxHeight: `${window.innerHeight - 250}px`,
    });
  };
  const planType = usePlanType();

  useEffect(() => {
    setButtonText(visual ? ta.createResources : ta.projectResourceConfigure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual]);

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const planRec = useMemo(
    () => findRecord(memory, 'plan', plan) as Plan | undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]
  );

  const isFlat = useMemo(() => {
    return planType(plan)?.flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  useEffect(() => {
    const newColumns: GridColDef[] = [
      {
        field: 'name',
        headerName: getOrganizedBy(true),
        width: 300,
        cellClassName: 'word-wrap',
      },
    ];
    if (!isFlat) {
      newColumns.push({
        field: 'passages',
        headerName: ts.passages,
        width: 120,
        align: 'right',
      });
    }
    setColumns([...newColumns]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlat]);

  const getSections = (
    passages: PassageD[],
    sections: SectionD[],
    bookData: BookName[]
  ) => {
    const rowData: IRow[] = [];
    let id = 1;
    sections
      .filter((s) => related(s, 'plan') === planRec?.id && s.attributes)
      .sort(sectionCompare)
      .forEach((section) => {
        const sectionpassages = passages
          .filter(
            (ps) =>
              related(ps, 'section') === section.id &&
              passageTypeFromRef(ps.attributes?.reference, isFlat) ===
                PassageTypeEnum.PASSAGE
          )
          .sort(passageCompare);
        const passageCount = sectionpassages.length;
        if (!isFlat && passageCount > 1)
          rowData.push({
            id: id++,
            recId: section.id,
            name: getSection(section, sectionpassages, sectionMap, bookData),
            passages: passageCount.toString(),
            parentId: '',
          });
        if (openSections.includes(section.id)) {
          sectionpassages.forEach((passage: Passage) => {
            rowData.push({
              id: id++,
              recId: passage.id,
              name: `${sectionNumber(section, sectionMap)}.${getReference(
                passage,
                bookData
              )}`,
              passages: '',
              parentId: isFlat || passageCount === 1 ? '' : section.id,
            } as IRow);
          });
        }
      });

    return rowData as Array<IRow>;
  };

  useEffect(() => {
    setData(getSections(passages, sections, allBookData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, passages, sections, allBookData, openSections]);

  const handleRowSelectionChange = (newSelection: GridRowSelectionModel) => {
    let chks = Array.from(newSelection.ids);
    if (newSelection.type === 'exclude') {
      chks = [];
      data.forEach((_r, i) => {
        if (!newSelection.ids.has(i)) chks.push(i);
      });
    }
    if (!eqSet(new Set(chks), new Set(checks))) {
      for (const c of chks) {
        let n = parseInt(c as string);
        if (data[n].parentId === '' && !checks.includes(n)) {
          while (++n < data.length && data[n].parentId !== '') {
            if (!chks.includes(n)) chks.push(n);
          }
        }
      }
      setChecks(chks);
    }
    setSelectedRows({ ...newSelection, ids: new Set(chks) });
  };

  const handleSelected = () => {
    const results = checks
      .sort((i, j) => parseInt(i as string) - parseInt(j as string))
      .map((c) => {
        const n = parseInt(c as string);
        return {
          type:
            data[n].parentId === '' && !isFlat && parseInt(data[n].passages) > 1
              ? 'section'
              : 'passage',
          id: data[n].recId,
        };
      }) as RecordIdentity[];
    onSelect && onSelect(results);
  };

  const sortModel: GridSortModel = [{ field: 'name', sort: 'asc' }];

  return (
    <Box id="SelectSections" sx={{ pt: 2, maxHeight: '70%' }}>
      <Typography variant="h6">{title}</Typography>
      <StyledPaper id="PassageList" style={heightStyle}>
        <TreeDataGrid
          columns={columns}
          rows={data}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={selectedRows}
          onRowSelectionModelChange={handleRowSelectionChange}
          recIdName="recId"
          expanded={setOpenSections}
          initialState={{ sorting: { sortModel } }}
          sx={{ '& .word-wrap': { wordWrap: 'break-spaces' } }}
        />
      </StyledPaper>
      <div>
        <Button
          onClick={handleSelected}
          variant="contained"
          color="primary"
          disabled={checks.length === 0}
        >
          {buttonText}
        </Button>
      </div>
    </Box>
  );
}

export default SelectSections;
