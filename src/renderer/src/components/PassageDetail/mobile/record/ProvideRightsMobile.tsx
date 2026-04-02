import React from 'react';
import { VoiceStatement } from '../../../../business/voice/VoiceStatement';
import MediaRecord from '../../../MediaRecord';
import { GrowingSpacer, PriButton } from '../../../../control';
import { Button, Typography, Box, LinearProgress } from '@mui/material';
import { SxProps } from '@mui/material/styles';
import {
  ICommunityStrings,
  ISharedStrings,
} from '../../../../store/localization/model';
import { Organization } from '../../../../model';
import { shallowEqual, useSelector } from 'react-redux';
import {
  communitySelector,
  sharedSelector,
} from '../../../../selector/selectors';
import { IVoicePerm } from '../../../../business/voice/PersonalizeVoicePermission';

interface IProps {
  paperRef: React.RefObject<HTMLDivElement | null>;
  paperProps: SxProps;
  paperWidth: number;
  rowProp: SxProps;
  statusProps: SxProps;
  statusText: string;
  canSave: boolean;
  recordingRequired: boolean | undefined;
  handleUpload: () => void;
  handleLater: () => void;
  handleSave: () => void;
  state: IVoicePerm;
  setState: React.Dispatch<React.SetStateAction<IVoicePerm>>;
  handleStatement: (statement: string) => void;
  busy: boolean;
  speaker: string;
  teamRec: Organization;
  toolId: string;
  team: string | undefined;
  defaultFilename: string;
  artifactState: { id: string | null };
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusText: React.Dispatch<React.SetStateAction<string>>;
  setResetMedia: React.Dispatch<React.SetStateAction<boolean>>;
  resetMedia: boolean;
  afterUploadCb: (url: string, filename: string) => void;
  handleSetCanSave: (canSave: boolean) => void;
}

const ProvideRightsMobile = (props: IProps) => {
  const t: ICommunityStrings = useSelector(communitySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  return (
    <div data-cy="provide-rights-mobile">
      <VoiceStatement
        voice={props.speaker}
        team={props.teamRec}
        state={props.state}
        saving={props.busy}
        setState={props.setState}
        setStatement={props.handleStatement}
      />
      <MediaRecord
        toolId={props.toolId}
        defaultFilename={props.defaultFilename}
        afterUploadCb={async (mediaId) => {
          props.afterUploadCb(mediaId || '', props.defaultFilename);
        }}
        artifactId={props.artifactState.id}
        passageId={undefined}
        performedBy={props.speaker}
        allowWave={false}
        allowDeltaVoice={false}
        allowNoNoise={false}
        setCanSave={props.handleSetCanSave}
        setStatusText={props.setStatusText}
        doReset={props.resetMedia}
        setDoReset={props.setResetMedia}
        height={200}
        width={props.paperWidth - 20 || 500}
        onSaving={() => props.setSaving(true)}
        handleUpload={props.handleUpload}
        handleSave={props.handleSave}
        isSaveDisabled={props.state?.valid === false}
        isRecordingRights={true}
      />
      <Box sx={props.rowProp} data-cy="provide-rights-actions">
        {!props.recordingRequired && (
          <Button id="spkr-later" onClick={props.handleLater}>
            {t.later}
          </Button>
        )}
        <Typography
          variant="caption"
          sx={props.statusProps}
          data-cy="provide-rights-status"
        >
          {props.statusText}
        </Typography>
        <GrowingSpacer />
        {props.canSave && (
          <PriButton
            id="spkr-save"
            sx={{ mx: 1 }}
            onClick={props.handleSave}
            disabled={props.state?.valid === false}
          >
            {ts.save}
          </PriButton>
        )}
      </Box>
      {props.busy && (
        <Box
          data-cy="provide-rights-busy"
          sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}
        >
          <Typography>{`${t.loading}\u00A0`}</Typography>
          <LinearProgress
            variant="indeterminate"
            sx={{ display: 'flex', flexGrow: 1 }}
          />
        </Box>
      )}
    </div>
  );
};

export default ProvideRightsMobile;
