import { useContext, useState } from 'react';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { Box, Fab, Grid } from '@mui/material';
import DiscussionList from './DiscussionList';
import CommentIcon from '@mui/icons-material/Comment';

interface DiscussionPanelProps {
  onPanel?: (value: boolean) => void;
}

export default function DiscussionPanel({ onPanel }: DiscussionPanelProps) {
  const ctx = useContext(PassageDetailContext);
  const { discussionSize, mediafileId } = ctx.state;
  const [discussOpen, setDiscussOpen] = useState(false);

  const handlePanel = (value: boolean) => {
    setDiscussOpen(value);
    onPanel?.(value);
  };

  return (
    Boolean(mediafileId) &&
    (discussOpen ? (
      <Grid size={{ xs: 12 }} container sx={{ width: discussionSize.width }}>
        <Grid container direction="column">
          <DiscussionList onClose={() => handlePanel(false)} />
        </Grid>
      </Grid>
    ) : (
      <Box sx={{ position: 'absolute', bottom: 10, right: 10 }}>
        <Fab size="small" onClick={() => handlePanel(true)}>
          <CommentIcon />
        </Fab>
      </Box>
    ))
  );
}
