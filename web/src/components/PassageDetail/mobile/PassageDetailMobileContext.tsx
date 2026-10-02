import { Box, Typography } from '@mui/material';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { passageRefText } from '../../../crud';
import { useGlobal } from '../../../context/useGlobal';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { ProjectD } from '../../../model';

export default function PassageDetailMobileContext() {
  const { passage, allBookData } = usePassageDetailContext();
  const [project] = useGlobal('project');
  const projects = useOrbitData<ProjectD[]>('project');
  const projectName =
    projects.find((p) => p.id === project)?.attributes?.name ?? '';
  const reference = passageRefText(passage, allBookData);

  return (
    <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 600 }}
        data-cy="mobile-reference"
      >
        {reference}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary' }}
        data-cy="mobile-project-name"
      >
        {projectName}
      </Typography>
    </Box>
  );
}
