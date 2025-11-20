import { useState } from 'react';
import { ISheet, BookNameMap } from '../../model';
import { Box, Typography } from '@mui/material';
import { PassageCard } from './PassageCard';
import StickyRedirect from '../StickyRedirect';
import { useParams } from 'react-router-dom';
import MediaPlayer from '../MediaPlayer';

interface IProps {
  rowInfo: ISheet[];
  bookMap: BookNameMap;
}

export function PlanView(props: IProps) {
  const { rowInfo, bookMap } = props;
  const { prjId } = useParams();

  const [view, setView] = useState('');
  const [srcMediaId, setSrcMediaId] = useState('');
  const [mediaPlaying, setMediaPlaying] = useState(false);

  const getBookName = (bookAbbreviation: string | undefined): string => {
    return bookAbbreviation && bookMap
      ? bookMap[bookAbbreviation]
      : bookAbbreviation || 'Unknown Book';
  };

  const onPlayStatus = (mediaId: string) => {
    if (mediaId === srcMediaId) {
      setMediaPlaying(!mediaPlaying);
    } else {
      setSrcMediaId(mediaId);
    }
  };

  const playEnded = () => {
    setMediaPlaying(false);
  };

  const handleViewStep = (passageIndex: number) => {
    const passageRemoteId = rowInfo[passageIndex].passage?.keys?.remoteId;

    setView(`/detail/${prjId}/${passageRemoteId}`);
  };

  if (view !== '') return <StickyRedirect to={view} />;

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
          return (
            <Typography key={row.sectionId?.id} variant="h4">
              Section {row.sectionSeq}
            </Typography>
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
      <MediaPlayer
        srcMediaId={srcMediaId}
        onEnded={playEnded}
        requestPlay={mediaPlaying}
      />
    </Box>
  );
}
