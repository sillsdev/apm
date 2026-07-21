import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { useGlobal } from '../../context/useGlobal';
import { useOrbitData } from '../../hoc/useOrbitData';
import { passageRefText } from '../../crud';
import { IState, PassageD, ProjectD } from '../../model';
import { useSelector } from 'react-redux';

export default function MobileDetailTitle() {
  const { pasId } = useParams();
  const passages = useOrbitData<PassageD[]>('passage');
  const projects = useOrbitData<ProjectD[]>('project');
  const [project] = useGlobal('project');
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const passage = useMemo(() => {
    if (!pasId) return undefined;
    return passages.find((p) => p.id === pasId || p.keys?.remoteId === pasId);
  }, [pasId, passages]);
  const reference = passage ? passageRefText(passage, allBookData) : '';
  const projectName =
    projects.find((p) => p.id === project)?.attributes?.name ?? '';

  return (
    <Box sx={{ ml: 1, minWidth: 0, overflow: 'hidden' }}>
      <Typography variant="subtitle2" noWrap sx={{ lineHeight: 1.1 }}>
        {reference}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ lineHeight: 1.1 }}
      >
        {projectName}
      </Typography>
    </Box>
  );
}
