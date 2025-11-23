import { useState } from 'react';
import { ISheet, BookNameMap } from '../../model';
import { Button, Box, Typography } from '@mui/material';
import PublishOnIcon from '@mui/icons-material/PublicOutlined';
import { PassageCard } from './PassageCard';
import StickyRedirect from '../StickyRedirect';
import { useParams } from 'react-router-dom';
import { GraphicAvatar } from './GraphicAvatar';
import { GrowingSpacer } from '../../control';

interface IProps {
  rowInfo: ISheet[];
  bookMap: BookNameMap;
  publishingView: boolean;
  handleOpenPublishDialog: (index: number) => void;
  handleGraphic: (index: number) => void;
  srcMediaId: string;
  mediaPlaying: boolean;
  onPlayStatus: (mediaId: string) => void;
}

export function PlanView(props: IProps) {
  const {
    rowInfo,
    bookMap,
    publishingView,
    handleOpenPublishDialog,
    handleGraphic,
    srcMediaId,
    mediaPlaying,
    onPlayStatus,
  } = props;
  const { prjId } = useParams();

  const [view, setView] = useState('');

  const getBookName = (bookAbbreviation: string | undefined): string => {
    return bookAbbreviation && bookMap
      ? bookMap[bookAbbreviation]
      : bookAbbreviation || 'Unknown Book';
  };

  const handleViewStep = (passageIndex: number) => {
    const passageRemoteId = rowInfo[passageIndex].passage?.keys?.remoteId;

    setView(`/detail/${prjId}/${passageRemoteId}`);
  };

  if (view !== '') return <StickyRedirect to={view} />;

  let bookCount = 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
      }}
    >
      {rowInfo.map((row, i) => {
        if (row.kind === 0) {
          const isBook = row.passageType === 'BOOK';
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
                mt: '1.5rem',
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
              {isBook ? (
                <Typography key={row.sectionId?.id} variant="h4">
                  {row.title}
                </Typography>
              ) : (
                <Typography key={row.sectionId?.id} variant="h4">
                  Section {row.sectionSeq}
                </Typography>
              )}
              <GrowingSpacer />
              {row.passageType === 'PASS' && publishingView ? (
                <Button
                  variant="outlined"
                  onClick={() => handleOpenPublishDialog(i)}
                  sx={{ color: 'primary.light' }}
                >
                  <PublishOnIcon fontSize="small" sx={{ mr: '.25rem' }} />{' '}
                  Publish
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
              isPlaying={mediaId === srcMediaId && mediaPlaying}
            />
          );
        }
      })}
    </Box>
  );
}
