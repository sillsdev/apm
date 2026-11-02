import { useEffect } from 'react';
import { Stack } from '@mui/material';
import {
  byRank,
  ReferenceTextRank,
} from '../../../business/referenceText/referenceText';
import { ReferenceTextActions } from './ReferenceTextActions';
import { ReferenceTextDialog } from './ReferenceTextDialog';
import { ReferenceTextStatus } from './ReferenceTextStatus';
import { useReferenceTextPlayback } from './useReferenceTextPlayback';
import { useShownReferenceTexts } from './useShownReferenceTexts';

interface IProps {
  rank: ReferenceTextRank;
  mobile?: boolean;
}

/**
 * The Reference Text picked as the Compare resource, in place of the media
 * player: Play speaks it and View shows it, as on Internalize.
 */
export function CompareReferenceText({ rank, mobile }: Readonly<IProps>) {
  const { passage, passages } = useShownReferenceTexts();
  // speakInstead is a new function each render; only a rank change should move speaking
  const { itemProps, viewing, closeView, speakInstead } =
    useReferenceTextPlayback(passages);
  const value = byRank(rank, passages);

  // Switching Primary and Secondary while one speaks speaks the other instead
  useEffect(() => {
    speakInstead(rank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rank]);

  if (value.status === 'none') return null;

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'center' }}
        data-cy={`compare-reference-text-${rank}`}
      >
        {value.status === 'ready' && (
          <ReferenceTextActions rank={rank} {...itemProps(rank)} />
        )}
        <ReferenceTextStatus passage={value} />
      </Stack>
      {viewing && (
        <ReferenceTextDialog
          {...viewing}
          passage={passage}
          mobile={mobile}
          onClose={closeView}
        />
      )}
    </>
  );
}

export default CompareReferenceText;
