import { SxProps } from '@mui/material';

/** Subject/topic row styles — wrap long questions instead of clipping (TT-6738). */
export const discussionCardTopicProps = {
  mr: 2,
  alignSelf: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  minWidth: 0,
  flex: 1,
} as SxProps;

export const discussionCardTopicItemProps = {
  display: 'flex',
  flexDirection: 'row',
  flex: 1,
  minWidth: 0,
} as SxProps;
