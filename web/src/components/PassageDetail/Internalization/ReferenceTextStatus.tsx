import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { ReferenceTextError } from '../../../business/referenceText/passageText';
import { IPassageDetailArtifactsStrings } from '../../../model';
import { passageDetailArtifactsSelector } from '../../../selector';
import { ShownReferenceTextPassage } from './referenceTextItem';

const errorText = (
  t: IPassageDetailArtifactsStrings,
  error: ReferenceTextError
) =>
  ({
    bookNotInText: t.referenceTextBookMissing,
    noRange: t.referenceTextNoRange,
    fetchFailed: t.referenceTextFetchFailed,
    empty: t.referenceTextEmpty,
  })[error];

interface IProps {
  passage: ShownReferenceTextPassage;
}

/** Loading or why a Reference Text row has no passage; nothing once it is ready. */
export function ReferenceTextStatus({ passage }: IProps) {
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  if (passage.status === 'ready') return null;
  if (passage.status === 'loading')
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CircularProgress size={16} aria-hidden />
        <Typography variant="body2" color="text.secondary" role="status">
          {t.referenceTextLoading}
        </Typography>
      </Stack>
    );
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" color="error">
        {errorText(t, passage.error)}
      </Typography>
      {passage.retry && (
        <Button size="small" onClick={passage.retry}>
          {t.referenceTextRetry}
        </Button>
      )}
    </Stack>
  );
}

export default ReferenceTextStatus;
