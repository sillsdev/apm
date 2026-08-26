import {
  ICommunityStrings,
  ISharedStrings,
  MediaFileD,
  Organization,
} from '../model';
import { SxProps } from '@mui/material/styles';
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { getRefWidth } from '../utils/getRefWidth';
import {
  ArtifactTypeSlug,
  useArtifactType,
  remoteIdGuid,
  findRecord,
  related,
  useUpdateRecord,
  orgDefaultVoices,
  useOrgDefaults,
} from '../crud';
import Memory from '@orbit/memory';
import { useSnackBar } from '../hoc/SnackBar';
import { cleanFileName } from '../utils';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { UnsavedContext } from '../context/UnsavedContext';
import Uploader from './Uploader';
import { communitySelector, sharedSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { AddRecord, ReplaceRelatedRecord } from '../model/baseModel';
import IntellectualProperty from '../model/intellectualProperty';
import { UploadType } from './UploadType';
import {
  RecordIdentity,
  RecordKeyMap,
  RecordTransformBuilder,
  UninitializedRecord,
} from '@orbit/records';
import React from 'react';
import { IVoicePerm } from '../business/voice/PersonalizeVoicePermission';
import ProvideRightsMobile from './PassageDetail/mobile/record/ProvideRightsMobile';

const paperProps = { p: 2, m: 'auto', width: `calc(100% - 32px)` } as SxProps;
const rowProp = { display: 'flex', p: 2 };
const statusProps = {
  mr: 2,
  alignSelf: 'center',
  display: 'block',
  gutterBottom: 'true',
} as SxProps;

interface IProps {
  speaker: string;
  aiip: boolean;
  recordType: ArtifactTypeSlug;
  onRights?: ((hasRights: boolean) => void) | undefined;
  team?: string | undefined;
  planId?: string | undefined;
}

export function ProvideRights(props: IProps) {
  const { speaker, recordType, onRights, team, planId, aiip } = props;
  const [user] = useGlobal('user');
  const [organizationId] = useGlobal('organization');
  const [busy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [state, setState] = useState<IVoicePerm>({});
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  const canSaveRef = useRef(false);
  const [defaultFilename, setDefaultFileName] = useState('');
  const [coordinator] = useGlobal('coordinator');
  const memory = coordinator?.getSource('memory') as Memory;
  const [importList, setImportList] = useState<File[]>();
  const [uploadVisible, setUploadVisiblex] = useState(false);
  const uploadVisibleRef = useRef(false);
  const [resetMedia, setResetMedia] = useState(false);
  const [statement, setStatement] = useState<string>('');
  const [, setSaving] = useState(false);
  const [paperWidth, setPaperWidth] = useState<number>(0);
  const paperRef = useRef<HTMLDivElement>(null);
  const getGlobal = useGetGlobal();
  const {
    toolChanged,
    toolsChanged,
    startSave,
    saveCompleted,
    saveRequested,
    clearRequested,
    clearCompleted,
  } = useContext(UnsavedContext).state;

  const { getTypeId } = useArtifactType();
  const { showMessage } = useSnackBar();
  const cancelled = useRef(false);
  const updateRecord = useUpdateRecord();
  const { getOrgDefault } = useOrgDefaults();
  const t: ICommunityStrings = useSelector(communitySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const toolId = 'RecordArtifactTool';

  const setUploadVisible = (value: boolean) => {
    setUploadVisiblex(value);
    uploadVisibleRef.current = value;
    if (value) {
      cancelled.current = false;
    }
  };
  const teamRec = React.useMemo(
    () =>
      findRecord(
        memory,
        'organization',
        team || organizationId
      ) as Organization,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, team]
  );

  useEffect(() => {
    toolChanged(toolId, canSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave]);

  const recordTypeId = useMemo(
    () => getTypeId(recordType),
    [recordType, getTypeId]
  );

  const artifactState = useMemo(() => ({ id: recordTypeId }), [recordTypeId]);

  useEffect(() => {
    setDefaultFileName(cleanFileName(`${speaker}_ip`));
    const state = getOrgDefault(orgDefaultVoices) as IVoicePerm;
    setState({ ...state, fullName: speaker } as IVoicePerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaker]);

  const updatePaperWidth = useCallback(() => {
    setPaperWidth(getRefWidth(paperRef));
  }, []);

  useEffect(() => {
    updatePaperWidth();
    window.addEventListener('resize', updatePaperWidth);
    return () => window.removeEventListener('resize', updatePaperWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperRef.current]);

  useEffect(() => {
    if (saveRequested(toolId) && canSave) handleSave();
    else if (clearRequested(toolId)) {
      clearCompleted(toolId);
    }

    return () => {
      if (!saveRequested(toolId)) {
        clearCompleted(toolId);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged, canSave]);

  const handleSave = () => {
    //tell the media recorder to save
    if (!saveRequested(toolId)) {
      startSave(toolId);
    }
  };

  const handleStatement = (statement: string) => {
    if (aiip) setStatement(statement);
  };

  const afterUploadCb = async (mediaId: string | undefined) => {
    if (mediaId) {
      let orgId = team || organizationId;
      if (!orgId) {
        const planRec = findRecord(memory, 'plan', planId || getGlobal('plan'));
        const projRec = findRecord(
          memory,
          'project',
          related(planRec, 'project')
        );
        orgId = related(projRec, 'organization');
      }
      const id =
        remoteIdGuid('mediafile', mediaId, memory?.keyMap as RecordKeyMap) ??
        mediaId;
      if (cancelled.current && id) {
        await memory.update((tr: RecordTransformBuilder) =>
          tr.removeRecord({ type: 'mediafile', id }).toOperation()
        );
      } else {
        if (statement) {
          const mediaRec = findRecord(memory, 'mediafile', id) as MediaFileD;
          updateRecord({
            ...mediaRec,
            attributes: { ...mediaRec.attributes, transcription: statement },
          } as MediaFileD);
        }
        const ip = {
          type: 'intellectualproperty',
          attributes: {
            rightsHolder: speaker,
            notes: JSON.stringify(state),
          },
        } as IntellectualProperty & UninitializedRecord;
        await memory.update((t) => [
          ...AddRecord(t, ip, user, memory),
          ...ReplaceRelatedRecord(
            t,
            ip as RecordIdentity,
            'releaseMediafile',
            'mediafile',
            id
          ),
          ...ReplaceRelatedRecord(
            t,
            ip as RecordIdentity,
            'organization',
            'organization',
            orgId
          ),
        ]);
        onRights && onRights(true);
      }
      if (importList) {
        setImportList(undefined);
        setUploadVisible(false);
        setResetMedia(true);
      }
      setStatusText('');
      saveCompleted(toolId);
    } else {
      setStatusText(ts.NoSaveWoMedia);
      saveCompleted(toolId, ts.NoSaveWoMedia);
    }
    setSaving(false);
    cancelled.current = false;
  };

  const afterUpload = async (planId: string, mediaRemoteIds?: string[]) => {
    afterUploadCb(
      mediaRemoteIds && mediaRemoteIds.length > 0
        ? mediaRemoteIds[0]
        : undefined
    );
  };

  const handleUploadVisible = (v: boolean) => {
    setUploadVisible(v);
  };
  const handleUpload = () => {
    if (canSave) {
      showMessage(t.saveFirst);
      return;
    }
    setImportList(undefined);
    setUploadVisible(true);
  };

  const handleSetCanSave = (valid: boolean) => {
    if (valid !== canSaveRef.current) {
      canSaveRef.current = valid;
      setCanSave(valid);
    }
  };

  const handleLater = () => {
    onRights && onRights(true);
  };

  return (
    <div>
      <ProvideRightsMobile
        aiip={aiip}
        paperRef={paperRef}
        paperProps={paperProps}
        rowProp={rowProp}
        statusProps={statusProps}
        speaker={speaker}
        team={team}
        planId={planId}
        state={state}
        handleUpload={handleUpload}
        handleLater={handleLater}
        handleSave={handleSave}
        canSave={canSave}
        busy={busy}
        setState={setState}
        handleStatement={handleStatement}
        toolId={toolId}
        statusText={statusText}
        teamRec={teamRec}
        defaultFilename={defaultFilename}
        artifactState={artifactState}
        setSaving={setSaving}
        setStatusText={setStatusText}
        setResetMedia={setResetMedia}
        resetMedia={resetMedia}
        afterUploadCb={(mediaId) => afterUploadCb(mediaId)}
        handleSetCanSave={handleSetCanSave}
        paperWidth={paperWidth}
      />
      <Uploader
        noBusy={false}
        importList={importList}
        isOpen={uploadVisible}
        onOpen={handleUploadVisible}
        showMessage={showMessage}
        multiple={false}
        finish={afterUpload}
        cancelled={cancelled}
        artifactState={artifactState}
        performedBy={speaker}
        planId={planId}
        uploadType={UploadType.IntellectualProperty}
      />
    </div>
  );
}

export default ProvideRights;
