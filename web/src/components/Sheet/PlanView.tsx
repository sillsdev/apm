import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  ISheet,
  PassageTypeEnum,
  IPlanSheetStrings,
  OrganizationD,
  IwsKind,
  SheetLevel,
} from '../../model';
import { Box, Typography, Grid, Stack, useTheme } from '@mui/material';
import PublishOnIcon from '@mui/icons-material/PublicOutlined';
import PublishOffIcon from '@mui/icons-material/PublicOffOutlined';
import { PassageCard } from './PassageCard';
import { CardSizeProvider } from '../CardSize/CardSize';
import StickyRedirect from '../StickyRedirect';
import { useParams } from 'react-router-dom';
import { GraphicAvatar } from './GraphicAvatar';
import { Button, GrowingSpacer } from '../../control';
import {
  isPersonalTeam,
  PublishDestinationEnum,
  remoteIdGuid,
  usePublishDestination,
  useOrganizedBy,
} from '../../crud';
import { useGlobal } from '../../context/useGlobal';
import { planSheetSelector } from '../../selector';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useSectionIdDescription } from './useSectionIdDescription';
import ConfirmPublishDialog from '../ConfirmPublishDialog';
import { rowTypes } from './rowTypes';
import { PlanContext } from '../../context/PlanContext';
import { LocalKey, localUserKey, rememberCurrentPassage } from '../../utils';
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
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const publishRow = useRef<number>(-1);
  const restoredRef = useRef(false);
  const { isMovement } = rowTypes(rowInfo);
  const teams = useOrbitData<OrganizationD[]>('organization');
  const getDescription = useSectionIdDescription();
  const { getOrganizedBy, localizedOrganizedBy } = useOrganizedBy();
  const t: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);
  const theme = useTheme();
  const [teamId] = useGlobal('organization');
  const [memory] = useGlobal('memory');
  const [offline] = useGlobal('offline');
  const { isPublished } = usePublishDestination();
  const editGraphic = !offline ? handleGraphic : undefined;
  const isPersonal = useMemo(
    () => isPersonalTeam(teamId, teams),
    [teamId, teams]
  );

  const currentPassageId = useMemo(() => {
    if (!rowInfo.length) return undefined;
    const lastPasId = localStorage.getItem(localUserKey(LocalKey.passage));
    if (!lastPasId) return undefined;
    const pasGuid =
      remoteIdGuid('passage', lastPasId, memory?.keyMap as RecordKeyMap) ||
      lastPasId;
    const row = rowInfo.findIndex((r) => r.passage?.id === pasGuid);
    return row >= 0 ? pasGuid : undefined;
  }, [rowInfo, memory]);

  const onPlayStatus = (mediaId: string) => {
    if (mediaId === srcMediaId) {
      setPlaying(!playing);
    } else {
      setSrcMediaId(mediaId);
      setPlaying(true);
    }
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
    if (restoredRef.current || !currentPassageId) return;
    const el = document.querySelector(
      `[data-cy="passage-card-${currentPassageId}"]`
    ) as HTMLElement | null;
    if (!el) return;
    restoredRef.current = true;
    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [currentPassageId, rowInfo]);

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

  // Get the heading text for a section row
  const sectionHeading = (row: ISheet) => {
    const description = getDescription(row);
    if (!/^\d+$/.test(description)) return description;
    const kind =
      row.level === SheetLevel.Movement
        ? localizedOrganizedBy('movement', true)
        : getOrganizedBy(true);
    return `${kind} ${description}`;
  };

  // Group the rows into sections with headings and their associated cards
  const groups = useMemo(() => {
    type Item = { row: ISheet; index: number };
    const result: { heading?: Item; cards: Item[] }[] = [];
    rowInfo.forEach((row, index) => {
      if (row.kind === IwsKind.Section) {
        result.push({ heading: { row, index }, cards: [] });
      } else if (
        row.kind === IwsKind.Passage ||
        row.kind === IwsKind.SectionPassage
      ) {
        // Cards before any heading get a group of their own
        if (!result.length) result.push({ cards: [] });
        result[result.length - 1].cards.push({ row, index });
      }
    });
    return result;
  }, [rowInfo]);

  if (view !== '') return <StickyRedirect to={view} />;

  const renderHeading = (row: ISheet, i: number, indent: boolean) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      {publishingView && (
        <GraphicAvatar
          graphicUri={row.graphicUri}
          reference={row.reference}
          sectionSeq={row.sectionSeq}
          organizedBy="B"
          style={indent ? { marginLeft: '2rem' } : undefined}
          onClick={editGraphic ? () => editGraphic(i) : undefined}
        />
      )}
      {row.passageType === PassageTypeEnum.BOOK ? (
        <Typography variant="h5">{row.title}</Typography>
      ) : row.passageType === PassageTypeEnum.ALTBOOK ? (
        <Typography
          variant="h5"
          // The avatar carries the indent when it's shown
          sx={{ pl: publishingView ? 0 : 2 }}
        >
          {row.title}
        </Typography>
      ) : (
        <Typography variant="h5">{sectionHeading(row)}</Typography>
      )}
      <GrowingSpacer />
      {row.passageType === 'PASS' && publishingView ? (
        <Button
          disabled={!canPublish}
          startIcon={
            isPublished(row.published) ? <PublishOffIcon /> : <PublishOnIcon />
          }
          onClick={() => onPublish(i)}
        >
          {t.published}
        </Button>
      ) : null}
    </Box>
  );

  let bookCount = 0;

  return (
    <CardSizeProvider>
      <Stack data-cy="plan-view" gap={3}>
        {groups.map((group) => {
          const heading = group.heading;
          let indent = false;
          if (
            heading?.row.passageType === PassageTypeEnum.BOOK ||
            heading?.row.passageType === PassageTypeEnum.ALTBOOK
          ) {
            bookCount++;
            indent = bookCount === 2;
          }
          return (
            <Stack
              key={heading?.row.sectionId?.id ?? group.cards[0].row.passage?.id}
              gap={theme.layout.gap}
            >
              {heading && renderHeading(heading.row, heading.index, indent)}
              {group.cards.length > 0 && (
                <Grid
                  container
                  // 5 cards per row on large screens
                  columns={{ xs: 1, sm: 2, md: 4, lg: 5 }}
                  spacing={theme.layout.gap}
                >
                  {group.cards.map(({ row, index: i }) => {
                    const mediaId = row.mediaId?.id;
                    return (
                      <Grid key={row.passage?.id} size={1}>
                        <PassageCard
                          cardInfo={row}
                          handleViewStep={() => handleViewStep(i)}
                          onPlayStatus={
                            mediaId ? () => onPlayStatus(mediaId) : undefined
                          }
                          onGraphicClick={
                            publishingView && editGraphic
                              ? () => editGraphic(i)
                              : undefined
                          }
                          isPlaying={playing && mediaId === srcMediaId}
                          isPlayActive={mediaId === srcMediaId}
                          isPersonal={isPersonal}
                          isCurrent={
                            !!currentPassageId &&
                            row.passage?.id === currentPassageId
                          }
                        />
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Stack>
          );
        })}
      </Stack>
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
    </CardSizeProvider>
  );
}
