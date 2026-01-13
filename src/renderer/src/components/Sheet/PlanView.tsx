import { useContext, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  ISheet,
  BookNameMap,
  SectionD,
  PassageTypeEnum,
  IPlanSheetStrings,
  OrganizationD,
} from '../../model';
import { Button, Box, Typography, Grid } from '@mui/material';
import PublishOnIcon from '@mui/icons-material/PublicOutlined';
import { PassageCard } from './PassageCard';
import StickyRedirect from '../StickyRedirect';
import { useParams } from 'react-router-dom';
import { GraphicAvatar } from './GraphicAvatar';
import { GrowingSpacer } from '../../control';
import { findRecord, isPersonalTeam } from '../../crud';
import { useGlobal } from '../../context/useGlobal';
import { sectionDescription } from '../../crud';
import { PlanContext } from '../../context/PlanContext';
import { planSheetSelector } from '../../selector';
import { useOrbitData } from '../../hoc/useOrbitData';

interface IProps {
  rowInfo: ISheet[];
  bookMap: BookNameMap;
  publishingView: boolean;
  handleOpenPublishDialog: (index: number) => void;
  handleGraphic: (index: number) => void;
}

export function PlanView(props: IProps) {
  const {
    rowInfo,
    bookMap,
    publishingView,
    handleOpenPublishDialog,
    handleGraphic,
  } = props;
  const { prjId } = useParams();
  const [memory] = useGlobal('memory');
  const ctx = useContext(PlanContext);
  const { sectionArr } = ctx.state;
  const [srcMediaId, setSrcMediaId] = useState<string | undefined>(undefined);
  const [view, setView] = useState('');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const sectionMap = useMemo(() => new Map(sectionArr), [sectionArr]);
  const t: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);
  const [teamId] = useGlobal('organization');
  const isPersonal = useMemo(
    () => isPersonalTeam(teamId, teams),
    [teamId, teams]
  );

  const onPlayStatus = (mediaId: string) => {
    setSrcMediaId(mediaId);
  };

  const getSectionRec = (id: string) =>
    findRecord(memory, 'section', id) as SectionD | undefined;

  const getBookName = (bookAbbreviation: string | undefined): string => {
    // For general projects (non-scripture), return empty string
    if (!ctx.state.scripture) {
      return '';
    }
    return bookAbbreviation && bookMap
      ? bookMap[bookAbbreviation]
      : bookAbbreviation || t.unknownBook;
  };

  const handleViewStep = (passageIndex: number) => {
    const passageRemoteId = rowInfo[passageIndex].passage?.keys?.remoteId;

    setView(`/detail/${prjId}/${passageRemoteId}`);
  };

  if (view !== '') return <StickyRedirect to={view} />;

  let bookCount = 0;

  return (
    <Grid
      container
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: '1rem',
        padding: '0 1.5rem',
      }}
    >
      {rowInfo.map((row, i) => {
        if (row.kind === 0) {
          const isBook =
            row.passageType === PassageTypeEnum.BOOK ||
            row.passageType === PassageTypeEnum.ALTBOOK;
          let indent = false;
          if (isBook) {
            bookCount++;
            indent = bookCount === 2;
          }
          return (
            <Box
              key={row.sectionId?.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                width: '100%',
                mt: '1rem',
              }}
            >
              {publishingView && (
                <GraphicAvatar
                  graphicUri={row.graphicUri}
                  reference={row.reference}
                  sectionSeq={row.sectionSeq}
                  organizedBy="B"
                  style={indent ? { marginLeft: '2rem' } : undefined}
                  onClick={() => handleGraphic(i)}
                />
              )}
              {row.passageType === PassageTypeEnum.BOOK ? (
                <Typography variant="h5">{row.title}</Typography>
              ) : row.passageType === PassageTypeEnum.ALTBOOK ? (
                <Typography variant="h5" sx={{ pl: 2 }}>
                  {row.title}
                </Typography>
              ) : (
                <Typography variant="h5">
                  {sectionDescription(
                    getSectionRec(row.sectionId?.id || '') as SectionD,
                    sectionMap
                  )}
                </Typography>
              )}
              <GrowingSpacer />
              {row.passageType === 'PASS' && publishingView ? (
                <Button
                  variant="outlined"
                  onClick={() => handleOpenPublishDialog(i)}
                  sx={{
                    color: 'primary.light',
                    minWidth: 'auto',
                    p: 0,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: '0.25rem 0.5rem',
                      gap: '0.25rem',
                      '& .MuiSvgIcon-root': {
                        margin: 0,
                      },
                    }}
                  >
                    <PublishOnIcon fontSize="small" /> {t.published}
                  </Box>
                </Button>
              ) : null}
            </Box>
          );
        } else if (row.kind === 1) {
          const mediaId = row.mediaId?.id;
          return (
            <PassageCard
              key={row.passage?.id}
              cardInfo={row}
              getBookName={getBookName}
              handleViewStep={() => handleViewStep(i)}
              onPlayStatus={mediaId ? () => onPlayStatus(mediaId) : undefined}
              isPlaying={mediaId === srcMediaId}
              isPersonal={isPersonal}
            />
          );
        } else {
          return null;
        }
      })}
    </Grid>
  );
}
