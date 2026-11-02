import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { useMediaUpload, useSharedResRead, VernacularTag } from '../../crud';
import {
  AutosaveSuffix,
  removeAllAutosaves,
  removeOldAutosaves,
} from '../../crud/autosaveMedia';
import { useStepTool } from '../../crud/useStepTool';
import { IState } from '../../model';
import { extensionFromAudioContentType } from '../../utils/mimeTypes';
import { passageDefaultFilename } from '../../utils/passageDefaultFilename';

export const AutosaveIntervalMs = 3000;

interface IProps {
  passageId: string;
  currentBlob: Blob | null | undefined;
  edited: boolean;
  enabled: boolean;
  performedBy: string;
  mimeType?: string;
  onStored: (blob: Blob) => void;
}

/**
 * Stores the passage's audio. `save()` makes it a permanent version; while
 * `enabled`, edits are also autosaved AutosaveIntervalMs after they stop.
 */
export const usePassageAudioSave = ({
  passageId,
  currentBlob,
  edited,
  enabled,
  performedBy,
  mimeType,
  onStored,
}: IProps) => {
  const [offline] = useGlobal('offline');
  const [connected] = useGlobal('connected');
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan');
  const [reporter] = useGlobal('errorReporter');
  const { passage, currentstep } = usePassageDetailContext();
  const { settings: toolSettings } = useStepTool(currentstep);
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const { getSharedResource } = useSharedResRead();
  // The running autosave or save, resolving to the audio it stored.
  const [saving, setSaving] = useState<Promise<typeof currentBlob>>();

  const fileBase = useMemo(() => {
    const sr = getSharedResource(passage);
    return passageDefaultFilename(
      passage,
      plan,
      memory,
      VernacularTag,
      offline,
      '',
      toolSettings,
      allBookData,
      sr?.attributes.title
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSharedResource, passage, plan, offline, toolSettings, allBookData]);

  const autosaveProps = { memory, passageId, planId: plan, offline, reporter };

  const upload = useMediaUpload({
    artifactId: VernacularTag,
    passageId,
    performedBy,
    mimeType,
    afterUploadCb: async (mediaId) => {
      if (!mediaId || !currentBlob) return;
      onStored(currentBlob);
      await removeOldAutosaves(autosaveProps);
    },
  });

  const saveAs = async (blob: Blob, suffix = '') => {
    const ext = extensionFromAudioContentType(blob.type);
    const name = `${fileBase}${suffix}.${ext}`;
    await upload([new File([blob], name, { type: blob.type })]);
    return blob;
  };

  const track = (running: Promise<typeof currentBlob>) => {
    setSaving(running);
    // A save that waited on this one has replaced it.
    const done = () => setSaving((s) => (s === running ? undefined : s));
    running.then(done, done);
    return running;
  };

  // A manual save
  const save = async () => {
    if (currentBlob) {
      await saveAs(currentBlob);
      await removeAllAutosaves(autosaveProps);
    }
    return currentBlob;
  };

  useEffect(() => {
    if (!currentBlob || !edited || !enabled || saving) return;
    if (!offline && !connected) return;
    const timer = setTimeout(
      () => void track(saveAs(currentBlob, AutosaveSuffix)).catch(() => {}),
      AutosaveIntervalMs
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlob, edited, enabled, saving, offline, connected]);

  return { save: () => track(save()), saving: !!saving };
};
