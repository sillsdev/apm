import { useContext } from 'react';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { ReferenceTextError } from '../../../business/referenceText/passageText';
import { TokenContext } from '../../../context/TokenProvider';
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
    unauthorized: t.referenceTextUnauthorized,
    forbidden: t.referenceTextForbidden,
    empty: t.referenceTextEmpty,
  })[error];

const buttonSx = { flexShrink: 0, whiteSpace: 'nowrap' };

interface IProps {
  passage: ShownReferenceTextPassage;
}

/** Loading or why a Reference Text row has no passage; nothing once it is ready. */
export function ReferenceTextStatus({ passage }: IProps) {
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  // The same renewal as the token-expiry dialog's Continue; the passage
  // fetches again when the new token arrives.
  const { resetExpiresAt } = useContext(TokenContext).state;
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
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
    >
      <Typography variant="body2" color="error" sx={{ minWidth: 0 }}>
        {errorText(t, passage.error)}
      </Typography>
      {passage.retry && (
        <Button size="small" onClick={passage.retry} sx={buttonSx}>
          {t.referenceTextRetry}
        </Button>
      )}
      {passage.error === 'unauthorized' && (
        <Button size="small" onClick={resetExpiresAt} sx={buttonSx}>
          {t.referenceTextRenewLogin}
        </Button>
      )}
    </Stack>
  );
}

export default ReferenceTextStatus;
