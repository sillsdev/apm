import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import {
  IPassageDetailArtifactsStrings,
  IMediaUploadStrings,
  MediaFileD,
  SectionResourceD,
} from '../../../model';
import { PlayInPlayer } from '../../../context/PlayInPlayer';
import { MediaUploadControlsRef } from '../../MediaUploadContent';
import {
  remoteIdGuid,
  useSecResCreate,
  findRecord,
  usePlan,
} from '../../../crud';
import { AIGenerated } from './resourceRows';
import { ReplaceRelatedRecord } from '../../../model/baseModel';
import { useOrbitData } from '../../../hoc/useOrbitData';
import {
  RecordIdentity,
  RecordKeyMap,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';
import { shallowEqual, useSelector } from 'react-redux';
import {
  mediaUploadSelector,
  passageDetailArtifactsSelector,
} from '../../../selector';
import { FaithBridge } from '../../../assets/brands';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { UnsavedContext } from '../../../context/UnsavedContext';
import { getProjectResourceAssignments } from './projectResourceAssignments';
import { descriptionRequiredForResource } from './resourceArtifactName';
import { UploadType } from '../../UploadType';
import { ResourceTypeEnum } from './ResourceTypeEnum';
import { buildResourcePendingRestore } from './buildResourcePendingRestore';
import { AddResourceAction } from './AddResourceAction';
import { useResourceArtifactTypes } from './useResourceArtifactTypes';

/** Shared and Scripture upload options don't go through the wizard. */
export type AddUploadAction =
  | AddResourceAction.Audio
  | AddResourceAction.Pdf
  | AddResourceAction.Text
  | AddResourceAction.Link;

/** Which action opened the wizard (see PassageDetailArtifacts). */
export type WizardLaunch =
  // Add menu: Audio / Pdf / Text / Link — enters at the upload step.
  | { kind: 'add'; action: AddUploadAction }
  // FaithBridge answer (markdown, or audio link + transcript) seeds the upload step.
  | { kind: 'faithbridge'; query: string; audioUrl: string; transcript: string }
  // Edit an existing general resource — starts at SelectSections, no upload.
  | { kind: 'editGeneralResource'; media: MediaFileD };
// Non-general resources are edited in a separate dialog.

// Steps reachable per launch:
//   add (Audio)            Upload → SelectSections → Configure (general resource),
//                          or Upload only (section/passage resource)
//   add (Pdf/Text/Link)    Upload only
//   faithbridge            Upload only
//   editGeneralResource    SelectSections → Configure (no Back to Upload)
export enum WizardStep {
  Upload,
  SelectSections,
  Configure,
}

// Only for guarding against a browser close that would lose work
const wizardCloseGuardToolId = 'AddResourceWizard-CloseGuard';

const initialUploadType = (launch: WizardLaunch): UploadType => {
  switch (launch.kind) {
    case 'faithbridge':
      return launch.audioUrl ? UploadType.FaithbridgeLink : UploadType.MarkDown;
    case 'editGeneralResource':
      return UploadType.Resource; // unused: edit has no Upload step
    case 'add':
      switch (launch.action) {
        case AddResourceAction.Link:
          return UploadType.Link;
        case AddResourceAction.Pdf:
          return UploadType.PdfResource;
        case AddResourceAction.Text:
          return UploadType.MarkDown;
        case AddResourceAction.Audio:
          return UploadType.Resource;
      }
  }
};

interface IUseAddResourceWizardProps {
  launchSource: WizardLaunch;
  onClose: () => void;
}

export function useAddResourceWizard({
  launchSource,
  onClose,
}: IUseAddResourceWizardProps) {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const sectionResources = useOrbitData<SectionResourceD[]>('sectionresource');
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan'); //will be constant here
  const { rowData, section, passage, setSelected } = usePassageDetailContext();
  const { AddSectionResource, InternalizationStep } = useSecResCreate(section);
  const { getPlan } = usePlan();
  const { toolChanged, toolsChanged, saveRequested, saveCompleted } =
    useContext(UnsavedContext).state;
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const tu: IMediaUploadStrings = useSelector(
    mediaUploadSelector,
    shallowEqual
  );

  const { resourceType, projResourceType } = useResourceArtifactTypes();

  // launchSource never changes while mounted
  const initUploadType = initialUploadType(launchSource);
  const initDescription =
    launchSource.kind === 'faithbridge' ? launchSource.query : '';

  const [step, setStep] = useState<WizardStep>(
    launchSource.kind === 'editGeneralResource'
      ? WizardStep.SelectSections
      : WizardStep.Upload
  );
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [uploadType, setUploadType] = useState<UploadType>(initUploadType);
  const isAddingAudioResource =
    launchSource.kind === 'add' &&
    launchSource.action === AddResourceAction.Audio;
  const aiGenerated = launchSource.kind === 'faithbridge';
  const markdownValue =
    launchSource.kind === 'faithbridge'
      ? launchSource.audioUrl
        ? `${launchSource.audioUrl}||${launchSource.transcript}`
        : launchSource.transcript
      : '';
  const [speaker, setSpeaker] = useState('');
  const [resourceReady, setResourceReady] = useState(
    descriptionRequiredForResource(undefined, initUploadType)
      ? Boolean(initDescription.trim())
      : true
  );
  const [resourceUploadFiles, setResourceUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pendingCloseConfirmation, setPendingCloseConfirmation] =
    useState(false);

  const cancelled = useRef(false);

  // --- Deferred upload ---
  // The file/take is chosen on the Upload step, but uploaded later from
  // SelectSections.

  const categoryIdRef = useRef<string | undefined>(undefined);

  // A ref, not state, so typing doesn't re-render. ResourceData owns the live value.
  const descriptionRef = useRef<string>(initDescription);
  const addCategorySaveRef = useRef<(() => Promise<string>) | null>(null);
  const pendingResourceSeqRef = useRef(0);

  const [projSelection, setProjSelection] = useState<{
    items: RecordIdentity[];
    candidates: RecordIdentity[];
  }>({ items: [], candidates: [] });
  const [projMedia, setProjMedia] = useState<MediaFileD | undefined>(
    launchSource.kind === 'editGeneralResource' ? launchSource.media : undefined
  );
  // Handle to the (hidden, still-mounted) Upload step's active tab;
  // SelectSections' Upload button calls it to upload the held file/take.
  const submitRef = useRef<MediaUploadControlsRef>({
    handleAddOrSave: null,
    handleCancel: null,
  });
  // Set while an upload triggered from SelectSections is in flight. Tells
  // afterUpload that the sections are already chosen: advance to Configure on
  // success, or stay on SelectSections on failure.
  const areSectionsPreselectedRef = useRef(false);
  // --- end deferred upload ---

  const [resourceKind, setResourceKind] = useState(
    ResourceTypeEnum.sectionResource
  );
  // Artifact type for the upload (Edit never uploads, so it doesn't need one).
  const artifactId =
    (resourceKind === ResourceTypeEnum.projectResource
      ? projResourceType
      : resourceType) ?? null;

  const planRec = plan ? getPlan(plan) : null;
  const filename = planRec?.attributes?.slug
    ? `${planRec.attributes.slug}resource`
    : 'resource';

  const isPassageResource = resourceKind === ResourceTypeEnum.passageResource;
  const isProjectResource = resourceKind === ResourceTypeEnum.projectResource;

  const resourcePendingRestore = useCallback(() => {
    // Project resources should not get staged as pending uploads; they need to be configured in one go.
    if (resourceKind === ResourceTypeEnum.projectResource) {
      return undefined;
    }
    const step = InternalizationStep();
    if (!step?.id) return undefined;
    pendingResourceSeqRef.current += 1;
    return buildResourcePendingRestore({
      resourceType: resourceKind,
      sectionId: section.id,
      passageId: passage.id,
      description: descriptionRef.current || null,
      sequenceNum: rowData.length + pendingResourceSeqRef.current,
      orgWorkflowStepId: step.id,
      ...(categoryIdRef.current
        ? { artifactCategoryId: categoryIdRef.current }
        : {}),
    });
  }, [
    InternalizationStep,
    resourceKind,
    section.id,
    passage.id,
    rowData.length,
  ]);

  const hasGeneralResourceUploadConflict = (
    files: File[],
    kind: ResourceTypeEnum
  ) => kind === ResourceTypeEnum.projectResource && files.length > 1;
  const resourceUploadValidationMessage = hasGeneralResourceUploadConflict(
    resourceUploadFiles,
    resourceKind
  )
    ? t.generalResourcesIndividually
    : '';
  const syncResourceReady = (
    type: UploadType,
    desc: string,
    files: File[] = resourceUploadFiles,
    kind: ResourceTypeEnum = resourceKind
  ) => {
    const descriptionReady = descriptionRequiredForResource(undefined, type)
      ? Boolean(desc.trim())
      : true;
    setResourceReady(
      descriptionReady && !hasGeneralResourceUploadConflict(files, kind)
    );
  };

  const afterUpload = async (mediaRemoteIds?: string[]) => {
    let cnt = rowData.length;
    const projRes = new Array<MediaFileD>();
    const removeMedia = new Array<RecordOperation>();
    const tr = new RecordTransformBuilder();
    let advanced = false;
    if (mediaRemoteIds && mediaRemoteIds.length > 0) {
      // mediaRemoteIds must already be pulled into memory (for remoteIdGuid).
      for (const remId of mediaRemoteIds) {
        cnt += 1;
        const id =
          remoteIdGuid('mediafile', remId, memory?.keyMap as RecordKeyMap) ||
          remId;
        const mediaRecId = { type: 'mediafile', id };
        if (cancelled.current) {
          removeMedia.push(tr.removeRecord(mediaRecId).toOperation());
          continue;
        }
        if (descriptionRef.current) {
          await memory.update((t) => [
            t.replaceAttribute(mediaRecId, 'topic', descriptionRef.current),
          ]);
        }
        if (categoryIdRef.current) {
          await memory.update((t) => [
            ...ReplaceRelatedRecord(
              t,
              mediaRecId,
              'artifactCategory',
              'artifactcategory',
              categoryIdRef.current
            ),
          ]);
        }
        if (isPassageResource) {
          await memory.update((t) => [
            ...ReplaceRelatedRecord(
              t,
              mediaRecId,
              'passage',
              'passage',
              passage.id
            ),
          ]);
        }
        if (!isProjectResource) {
          await AddSectionResource(
            cnt,
            descriptionRef.current,
            mediaRecId,
            isPassageResource ? passage.id : null
          );
        } else {
          projRes.push(findRecord(memory, 'mediafile', id) as MediaFileD);
        }
      }
      if (projRes.length === 1) {
        if (areSectionsPreselectedRef.current) {
          const media = projRes[0] as MediaFileD;
          setProjMedia(media);
          areSectionsPreselectedRef.current = false;
          setUploading(false);
          setSelected(media.id, PlayInPlayer.yes);
          setStep(WizardStep.Configure);
          advanced = true;
        }
      }
    }
    if (removeMedia.length > 0) {
      await memory.update(removeMedia);
    }
    cancelled.current = false;
    // Deferred upload failed (uploader already showed the error). Re-enable
    // SelectSections' Upload so the user can retry with the same selection.
    if (areSectionsPreselectedRef.current && projRes.length === 0) {
      areSectionsPreselectedRef.current = false;
      setUploading(false);
      return;
    }
    // Section/passage resource created, or cancelled/empty upload: done.
    if (!advanced) onClose();
  };

  // Commit the staged new category (if any) right before the real upload.
  const handleBeforeUpload = async () => {
    pendingResourceSeqRef.current = 0;
    if (addCategorySaveRef.current) {
      categoryIdRef.current = await addCategorySaveRef.current();
      // Cleared so a retry can't create a duplicate category.
      addCategorySaveRef.current = null;
    }
  };

  // Upload step Next (general resource): go to SelectSections without uploading;
  // the hidden Upload step keeps the file/take until submitRef fires it.
  const handleUploadStepNext = () => {
    setProjMedia(undefined);
    setStep(WizardStep.SelectSections);
  };

  const handleSectionsSelected = (
    items: RecordIdentity[],
    candidates: RecordIdentity[]
  ) => {
    setProjSelection({ items, candidates });
    if (isAddingAudioResource && !projMedia) {
      // Nothing uploaded yet. Fire the held upload now. SelectSections shows a
      // spinner until afterUpload advances or re-enables it.
      const submit = submitRef.current.handleAddOrSave;
      if (!submit) return;
      cancelled.current = false;
      areSectionsPreselectedRef.current = true;
      setUploading(true);
      void Promise.resolve(submit());
      return;
    }
    setStep(WizardStep.Configure);
  };

  // We are doing Edit flow: load the existing media into the player on mount. (Add flows
  // do this after their upload.)
  // TODO cleanup in next PR: this needn't be an effect — the parent's "edit
  // general resource" handler could call setSelected before opening the wizard.
  useEffect(() => {
    if (launchSource.kind === 'editGeneralResource') {
      setSelected(launchSource.media.id, PlayInPlayer.yes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Configure the Back button (add flow only). SelectSections stayed mounted, so its
  // selection is preserved.
  const handleConfigureBack = () => setStep(WizardStep.SelectSections);

  // SelectSections Back (add flow only): back to Upload to change the audio.
  // Any already-uploaded media is left in place; a replacement creates a new one.
  const handleSelectSectionsBack = () => {
    setProjMedia(undefined);
    setStep(WizardStep.Upload);
  };

  const handleCategory = (categoryId: string) => {
    categoryIdRef.current = categoryId;
  };

  const handleResourceUploadFiles = (files: File[]) => {
    setResourceUploadFiles(files);
    syncResourceReady(uploadType, descriptionRef.current, files);
  };

  const handleDescription = (desc: string) => {
    descriptionRef.current = desc;
    syncResourceReady(uploadType, desc);
  };

  const handlePassRes = (newValue: ResourceTypeEnum) => {
    setResourceKind(newValue);
    if (newValue === ResourceTypeEnum.projectResource) {
      setUploadType(UploadType.ProjectResource);
      syncResourceReady(
        UploadType.ProjectResource,
        descriptionRef.current,
        resourceUploadFiles,
        newValue
      );
    } else if (uploadType === UploadType.ProjectResource) {
      setUploadType(UploadType.Resource);
      syncResourceReady(
        UploadType.Resource,
        descriptionRef.current,
        resourceUploadFiles,
        newValue
      );
    }
  };

  // Confirm close only when work would be lost (#719): always on Configure
  // (saved but unconfigured resource); on Upload/SelectSections only after a
  // recording started
  const needConfirmClose =
    step === WizardStep.Configure ||
    ((step === WizardStep.Upload || step === WizardStep.SelectSections) &&
      recordingStarted);

  const handleWizardClose = (v: boolean) => {
    if (v) return;
    if (needConfirmClose) setPendingCloseConfirmation(true);
    else onClose();
  };

  // Mirror needConfirmClose into the unsaved-changes flag, so browser/app close
  // warns in the same states as the dialog X.
  useEffect(() => {
    toolChanged(wizardCloseGuardToolId, needConfirmClose);
    return () => toolChanged(wizardCloseGuardToolId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needConfirmClose]);

  // Nothing to save here: answer a save-all (e.g. Electron exit) as done so it
  // isn't blocked. Unsaved wizard work is dropped, like MediaTitle/TitleTabs.
  useEffect(() => {
    if (saveRequested(wizardCloseGuardToolId))
      saveCompleted(wizardCloseGuardToolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  // Upload step uses the type-specific title; later steps say add vs edit.
  const uploadStepTitle = isAddingAudioResource
    ? t.addAudioResource
    : uploadType === UploadType.Link
      ? tu.linkTitle
      : uploadType === UploadType.MarkDown
        ? tu.markdownTitle
        : uploadType === UploadType.FaithbridgeLink
          ? tu.faithbridgeTitle.replace('{0}', FaithBridge)
          : uploadType === UploadType.PdfResource
            ? tu.pdfResourceTitle
            : tu.resourceTitle;
  const wizardTitle =
    step === WizardStep.Upload
      ? uploadStepTitle
      : isAddingAudioResource
        ? t.addAudioResource
        : t.editGeneralResource;

  // SelectSections reads this only at mount and stays mounted for the whole
  // wizard, so compute it once: the saved assignments when editing, none when adding.
  const [initialItems] = useState<RecordIdentity[]>(() =>
    launchSource.kind === 'editGeneralResource'
      ? getProjectResourceAssignments(
          launchSource.media,
          mediafiles,
          sectionResources,
          resourceType
        )
      : []
  );

  return {
    // strings / labels
    t,
    step,
    wizardTitle,
    isAddingAudioResource,
    // seeded upload-step values
    uploadType,
    resourceReady,
    speaker,
    setSpeaker,
    markdownValue,
    eafUrl: aiGenerated ? AIGenerated : '',
    filename,
    resourceUploadValidationMessage,
    resourceKind,
    resourceType,
    // Seed only: ResourceData owns the live value (reported via handleDescription).
    initDescription,
    projMedia,
    projIdentity: projSelection.items,
    projCandidate: projSelection.candidates,
    cancelled,
    artifactId,
    addCategorySaveRef,
    submitRef,
    // section-select
    initialItems,
    uploading,
    pendingCloseConfirmation,
    setPendingCloseConfirmation,
    // handlers
    setRecordingStarted,
    afterUpload,
    handleBeforeUpload,
    resourcePendingRestore,
    handleResourceUploadFiles,
    handleDescription,
    handleCategory,
    handlePassRes,
    handleUploadStepNext,
    handleSectionsSelected,
    handleSelectSectionsBack,
    handleConfigureBack,
    handleWizardClose,
  };
}
