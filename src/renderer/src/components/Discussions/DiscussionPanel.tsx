import { useContext } from 'react';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { Box, Fab, Grid } from '@mui/material';
import DiscussionList from './DiscussionList';
import CommentIcon from '@mui/icons-material/Comment';

export default function DiscussionPanel() {
  const ctx = useContext(PassageDetailContext);
  const { discussionSize, mediafileId, discussOpen, setDiscussOpen } =
    ctx.state;

  return (
    Boolean(mediafileId) &&
    (discussOpen ? (
      <Grid
        size={{ xs: 12 }}
        container
        sx={{ width: discussionSize.width, justifyContent: 'center' }}
      >
        <Grid container direction="column">
          <DiscussionList onClose={() => setDiscussOpen(false)} />
        </Grid>
      </Grid>
    ) : (
      <Box sx={{ position: 'fixed', bottom: 10, right: 10, zIndex: 1000 }}>
        <Fab size="small" onClick={() => setDiscussOpen(true)}>
          <CommentIcon />
        </Fab>
      </Box>
    ))
  );
}
