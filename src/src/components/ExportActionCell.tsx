import {
  PassageD,
  MediaFileD,
  ActivityStates,
  ITranscriptionTabStrings,
} from '../model';
import { IconButton, Box } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { getMediaInPlans } from '../crud';
import AudioDownload from './AudioDownload';
import { GridRenderCellParams } from '@mui/x-data-grid';
import { useGlobal } from '../context/useGlobal';
import { usePassageState } from '../crud';
import { transcriptionTabSelector } from '../selector';

interface IProps {
  handleEaf: (passageId: string) => () => void;
}

export const ExportActionCell = (params: GridRenderCellParams & IProps) => {
  const { handleEaf } = params;
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan');
  const t: ITranscriptionTabStrings = useSelector(
    transcriptionTabSelector,
    shallowEqual
  );
  const getPassageState = usePassageState();
  if (params.row.parentId) {
    const passRec = memory?.cache.query((q) =>
      q.findRecord({ type: 'passage', id: params.row.recId })
    ) as PassageD;
    const state = getPassageState(passRec);
    const media = memory?.cache.query((q) =>
      q
        .findRecords('mediafile')
        .filter({ relation: 'passage', record: passRec })
    ) as MediaFileD[];
    const latest = plan ? getMediaInPlans([plan], media, null, true) : [];
    const latestMedia = latest?.[0] as MediaFileD | undefined;
    const mediaId = latestMedia?.id as string;
    const transcription = latestMedia?.attributes?.transcription?.trim();
    const hasTranscription = transcription && transcription.length > 0;
    if (state !== ActivityStates.NoMedia && latest.length > 0)
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            id={'eaf-' + params.value}
            key={'eaf-' + params.value}
            aria-label={'eaf-' + params.value}
            color="default"
            sx={{ fontSize: 'small' }}
            onClick={handleEaf(params.value)}
            disabled={!hasTranscription}
          >
            {t.elan}
            <br />
            {t.export}
          </IconButton>
          <AudioDownload mediaId={mediaId} title={t.download} />
        </Box>
      );
  }
  return <Box />;
};
