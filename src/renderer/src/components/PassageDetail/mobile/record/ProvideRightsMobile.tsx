import React from 'react';
import { VoiceStatement } from '../../../../business/voice/VoiceStatement';
import MediaRecord from '../../../MediaRecord';
import { Button, GrowingSpacer } from '../../../../control';
import { Typography, Box, LinearProgress, IconButton } from '@mui/material';
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
  voiceSelector,
} from '../../../../selector/selectors';
import { IVoicePerm } from '../../../../business/voice/PersonalizeVoicePermission';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useMobile } from '../../../../utils';

interface IProps {
  paperRef: React.RefObject<HTMLDivElement | null>;
  paperProps: SxProps;
  paperWidth: number;
  rowProp: SxProps;
  statusProps: SxProps;
  statusText: string;
  canSave: boolean;
  handleUpload: () => void;
  handleLater: () => void;
  handleSave: () => void;
  state: IVoicePerm;
  setState: React.Dispatch<React.SetStateAction<IVoicePerm>>;
  handleStatement: (statement: string) => void;
  busy: boolean;
  aiip: boolean;
  speaker: string;
  teamRec: Organization;
  toolId: string;
  team: string | undefined;
  planId?: string | undefined;
  defaultFilename: string;
  artifactState: { id: string | null };
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusText: React.Dispatch<React.SetStateAction<string>>;
  setResetMedia: React.Dispatch<React.SetStateAction<boolean>>;
  resetMedia: boolean;
  afterUploadCb: (url: string, filename: string) => void | Promise<void>;
  /** Domain restore metadata for pending-upload Retry (TT-7363). */
  pendingRestore?: import('../../../../store/upload/pendingMediaUploads').PendingRestoreInput;
  handleSetCanSave: (canSave: boolean) => void;
}

const ProvideRightsMobile = (props: IProps) => {
  const t: ICommunityStrings = useSelector(communitySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tv = useSelector(voiceSelector, shallowEqual);
  const { isMobileWidth } = useMobile();
  const [actions, setActions] = React.useState<
    | {
        copy: () => void;
        personalize: () => void;
      }
    | undefined
  >(undefined);

  const registerActions = React.useCallback(
    (a: { copy: () => void; personalize: () => void }) => setActions(() => a),
    []
  );

  return (
    <div data-cy="provide-rights-mobile">
      <VoiceStatement
        aiip={props.aiip}
        voice={props.speaker}
        team={props.teamRec}
        state={props.state}
        saving={props.busy}
        setState={props.setState}
        setStatement={props.handleStatement}
        registerActions={registerActions}
        forceMobileLayout={true}
      />
      <MediaRecord
        toolId={props.toolId}
        defaultFilename={props.defaultFilename}
        afterUploadCb={async (mediaId) => {
          await props.afterUploadCb(mediaId || '', props.defaultFilename);
        }}
        artifactId={props.artifactState.id}
        passageId={undefined}
        planId={props.planId}
        performedBy={props.speaker}
        pendingRestore={props.pendingRestore}
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
        forceMobileView={true}
        rightsLeftActions={
          !isMobileWidth && actions ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton
                data-cy="voice-statement-copy"
                onClick={actions.copy}
                title={ts.clipboardCopy}
                sx={{ mr: 1 }}
              >
                <ContentCopyIcon color="primary" fontSize="small" />
              </IconButton>
              <Button
                data-cy="voice-statement-personalize"
                sx={{ m: 0, mr: 1 }}
                disabled={props.busy}
                onClick={actions.personalize}
              >
                {tv.personalize}
              </Button>
            </Box>
          ) : undefined
        }
      />
      <Box sx={props.rowProp} data-cy="provide-rights-actions">
        {!props.aiip && (
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
          <Button
            id="spkr-save"
            sx={{ mx: 1 }}
            color="primary"
            disabled={props.state?.valid === false}
            onClick={props.handleSave}
          >
            {ts.save}
          </Button>
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
