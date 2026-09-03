import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  ISheet,
  PassageTypeEnum,
  IPlanSheetStrings,
  OrganizationD,
  IwsKind,
} from '../../model';
import { Box, Typography, Grid } from '@mui/material';
import PublishOnIcon from '@mui/icons-material/PublicOutlined';
import PublishOffIcon from '@mui/icons-material/PublicOffOutlined';
import { PassageCard } from './PassageCard';
import StickyRedirect from '../StickyRedirect';
import { useParams } from 'react-router-dom';
import { GraphicAvatar } from './GraphicAvatar';
import { Button, GrowingSpacer } from '../../control';
import {
  isPersonalTeam,
  PublishDestinationEnum,
  remoteIdGuid,
  usePublishDestination,
} from '../../crud';
import { useGlobal } from '../../context/useGlobal';
import { planSheetSelector } from '../../selector';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useSectionIdDescription } from './useSectionIdDescription';
import ConfirmPublishDialog from '../ConfirmPublishDialog';
import { rowTypes } from './rowTypes';
import { PlanContext } from '../../context/PlanContext';
import {
  LocalKey,
  localUserKey,
  rememberCurrentPassage,
} from '../../utils';
import { RecordKeyMap } from '@orbit/records';

interface IProps {
  rowInfo: ISheet[];
  publishingView: boolean;
  handlePublish: (
    index: number,
    destinations: PublishDestinationEnum[]
  ) => void;
  handleGraphic?: (index: number) => void;
}

export function PlanView(props: IProps) {
  const { rowInfo, publishingView, handlePublish, handleGraphic } = props;
  const { prjId } = useParams();
  const ctx = useContext(PlanContext);
  const { shared, publishingOn, canPublish } = ctx.state;
  const [srcMediaId, setSrcMediaId] = useState<string | undefined>(undefined);
  const [view, setView] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const publishRow = useRef<number>(-1);
  const restoredRef = useRef(false);
  const { isMovement } = rowTypes(rowInfo);
  const teams = useOrbitData<OrganizationD[]>('organization');
  const getDescription = useSectionIdDescription();
  const t: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);
  const [teamId] = useGlobal('organization');
  const [memory] = useGlobal('memory');
  const { isPublished } = usePublishDestination();
  const isPersonal = useMemo(
    () => isPersonalTeam(teamId, teams),
    [teamId, teams]
  );

  const onPlayStatus = (mediaId: string) => {
    setSrcMediaId(mediaId);
  };

  const handleViewStep = (passageIndex: number) => {
    const passage = rowInfo[passageIndex].passage;
    const passageRemoteId = passage?.keys?.remoteId;
    if (passage?.id) {
      void rememberCurrentPassage(memory, passage.id);
    }
    setView(`/detail/${prjId}/${passageRemoteId}`);
  };

  useEffect(() => {
    if (restoredRef.current || !rowInfo.length) return;
    const lastPasId = localStorage.getItem(localUserKey(LocalKey.passage));
    if (!lastPasId) return;
    const pasGuid =
      remoteIdGuid(
        'passage',
        lastPasId,
        memory?.keyMap as RecordKeyMap
      ) || lastPasId;
    const row = rowInfo.findIndex((r) => r.passage?.id === pasGuid);
    if (row < 0) return;
    const el = document.querySelector(
      `[data-cy="passage-card-${pasGuid}"]`
    ) as HTMLElement | null;
    if (!el) return;
    restoredRef.current = true;
    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [rowInfo, memory]);

  const publishConfirm = async (destinations: PublishDestinationEnum[]) => {
    setConfirmPublish(false);
    handlePublish(publishRow.current, destinations);
  };
  const publishRefused = () => {
    setConfirmPublish(false);
  };

  const onPublish = (rowIndex: number) => {
    publishRow.current = rowIndex;
    setConfirmPublish(true);
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
      }}
    >
      {rowInfo.map((row, i) => {
        if (row.kind === IwsKind.Section) {
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
              }}
            >
              {publishingView && (
                <GraphicAvatar
                  graphicUri={row.graphicUri}
                  reference={row.reference}
                  sectionSeq={row.sectionSeq}
                  organizedBy="B"
                  style={indent ? { marginLeft: '2rem' } : undefined}
                  onClick={handleGraphic ? () => handleGraphic(i) : undefined}
                />
              )}
              {row.passageType === PassageTypeEnum.BOOK ? (
                <Typography variant="h5">{row.title}</Typography>
              ) : row.passageType === PassageTypeEnum.ALTBOOK ? (
                <Typography variant="h5" sx={{ pl: 2 }}>
                  {row.title}
                </Typography>
              ) : (
                <Typography variant="h5">{getDescription(row)}</Typography>
              )}
              <GrowingSpacer />
              {row.passageType === 'PASS' && publishingView ? (
                <Button
                  disabled={!canPublish}
                  startIcon={
                    isPublished(rowInfo[i].published) ? (
                      <PublishOffIcon />
                    ) : (
                      <PublishOnIcon />
                    )
                  }
                  onClick={() => onPublish(i)}
                >
                  {t.published}
                </Button>
              ) : null}
            </Box>
          );
        } else if (
          row.kind === IwsKind.Passage ||
          row.kind === IwsKind.SectionPassage
        ) {
          const mediaId = row.mediaId?.id;
          return (
            <PassageCard
              key={row.passage?.id}
              cardInfo={row}
              handleViewStep={() => handleViewStep(i)}
              onPlayStatus={mediaId ? () => onPlayStatus(mediaId) : undefined}
              onGraphicClick={
                publishingView && handleGraphic
                  ? () => handleGraphic(i)
                  : undefined
              }
              isPlaying={mediaId === srcMediaId}
              isPersonal={isPersonal}
            />
          );
        } else {
          return null;
        }
      })}
      {confirmPublish && (
        <ConfirmPublishDialog
          context="plan"
          isMovement={isMovement(publishRow.current)}
          yesResponse={publishConfirm}
          noResponse={publishRefused}
          current={rowInfo[publishRow.current].published}
          sharedProject={shared}
          hasPublishing={publishingOn}
          passageType={rowInfo[publishRow.current]?.passageType}
        />
      )}
    </Grid>
  );
}
