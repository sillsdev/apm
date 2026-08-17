import { Stack } from '@mui/material';
import MediaRecord from './MediaRecord';
import { ActionRow, AltButton, PriButton } from './StepEditor';
import { ISharedStrings } from '../model';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../selector';
import { ArtifactTypeSlug } from '../crud';
import { useRef, useState, useEffect, useCallback } from 'react';
import { getRefWidth } from '../utils/getRefWidth';

interface IProps {
  recToolId: string;
  passageId: string | undefined;
  planId: string | undefined;
  defaultFilename: string;
  autoStart?: boolean;
  canSave: boolean;
  onMyRecording: (recording: boolean) => void;
  handleSetCanSave: (canSave: boolean) => void;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  setStatusText: (status: string) => void;
  onCancel?: () => void;
  onSave?: () => void;
}

export default function TitleRecord(props: IProps) {
  const {
    recToolId,
    passageId,
    planId,
    defaultFilename,
    onMyRecording,
    afterUploadCb,
    canSave,
    handleSetCanSave,
    setStatusText,
    onCancel,
    onSave,
  } = props;
  const [stackWidth, setStackWidth] = useState<number>(0);
  const stackRef = useRef<HTMLDivElement>(null);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const updateStackWidth = useCallback(() => {
    setStackWidth(getRefWidth(stackRef));
  }, []);

  useEffect(() => {
    updateStackWidth();
    window.addEventListener('resize', updateStackWidth);
    return () => window.removeEventListener('resize', updateStackWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackRef.current]);

  return (
    <Stack ref={stackRef} direction="column" spacing={2}>
      <MediaRecord
        toolId={recToolId}
        passageId={passageId}
        planId={planId}
        artifactTypeSlug={
          passageId !== undefined
            ? ArtifactTypeSlug.Vernacular
            : ArtifactTypeSlug.Title
        }
        onRecording={onMyRecording}
        defaultFilename={defaultFilename}
        allowWave={false}
        setCanSave={handleSetCanSave}
        setStatusText={setStatusText}
        afterUploadCb={afterUploadCb}
        height={200}
        width={stackWidth}
        allowDeltaVoice={true}
        allowNoNoise={false}
        autoStart={false}
      />
      <ActionRow>
        <AltButton onClick={onCancel}>{ts.cancel}</AltButton>
        <PriButton disabled={!canSave} onClick={onSave}>
          {ts.save}
        </PriButton>
      </ActionRow>
    </Stack>
  );
}
