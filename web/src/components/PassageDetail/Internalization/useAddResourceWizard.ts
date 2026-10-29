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
  useOrganizedBy,
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
import { useResourceScopeLabels } from './useResourceScopeLabels';
import { useResourceArtifactTypes } from './useResourceArtifactTypes';

/** Upload-based actions handled by this wizard. Shared and Scripture don't use
 *  the Uploader and stay with the parent. */
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

// Unsaved-context tool flagged while closing would lose work, so a browser
// close warns too. Not used for saving.
const wizardCloseGuardToolId = 'AddResourceWizard-CloseGuard';

interface IUseAddResourceWizardProps {
  /** Which action opened the wizard; read once at mount to seed state. */
  launchSource: WizardLaunch;
  /** Cancel/finish/discard. The parent unmounts the wizard; each open is a fresh mount. */
  onClose: () => void;
}

/** State, effects and handlers for AddResourceWizard. Step components keep
 *  their own state across Back/Next. */
export function useAddResourceWizard({
  launchSource,
  onClose,
}: IUseAddResourceWizardProps) {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const sectionResources = useOrbitData<SectionResourceD[]>('sectionresource');
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan'); //will be constant here
  const { rowData, section, passage, setSelected } = usePassageDetailContext();
  const { getOrganizedBy } = useOrganizedBy();
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

  // Launch-derived state is seeded at mount; launchSource never changes while
  // mounted. Ternaries test launchSource.kind directly so TypeScript narrows.
  const initUploadType: UploadType =
    launchSource.kind === 'editGeneralResource'
      ? UploadType.Resource
      : launchSource.kind === 'faithbridge'
        ? launchSource.audioUrl
          ? UploadType.FaithbridgeLink
          : UploadType.MarkDown
        : launchSource.action === AddResourceAction.Link
          ? UploadType.Link
          : launchSource.action === AddResourceAction.Pdf
            ? UploadType.PdfResource
            : launchSource.action === AddResourceAction.Text
              ? UploadType.MarkDown
              : UploadType.Resource; // Audio
  const initDescription =
    launchSource.kind === 'faithbridge' ? launchSource.query : '';

  const [step, setStep] = useState<WizardStep>(
    launchSource.kind === 'editGeneralResource'
      ? WizardStep.SelectSections
      : WizardStep.Upload
  );
  // Set once any recording starts; never cleared. Gates the close confirm on the
  // Upload and SelectSections steps (#719). So we confirm before closing if a recording
  // has been made (even if it was discarded).
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
  const [performedBy, setPerformedBy] = useState('');
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
  // SelectSections. Refs carry values across that gap without stale closures.
  const artifactState = useRef<{ id?: string | null }>({
    // Edit keeps the media's existing type.
    id:
      launchSource.kind === 'editGeneralResource'
        ? undefined
        : (resourceType ?? null),
  });
  const categoryIdRef = useRef<string | undefined>(undefined);
  const descriptionRef = useRef<string>(initDescription);
  const addCategorySaveRef = useRef<(() => Promise<string>) | null>(null);
  const pendingResourceSeqRef = useRef(0);
  const projIdentityRef = useRef<RecordIdentity[]>([]);
  /** Every passage/section the selection dialog offered; scopes cleanup. */
  const projCandidateRef = useRef<RecordIdentity[]>([]);
  const projMediaRef = useRef<MediaFileD | undefined>(
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

  const [resourceKind, setResourceKindx] = useState(
    ResourceTypeEnum.sectionResource
  );
  const resourceKindRef = useRef(resourceKind);
  const setResourceKind = (kind: ResourceTypeEnum) => {
    resourceKindRef.current = kind;
    setResourceKindx(kind);
  };

  const planRec = plan ? getPlan(plan) : null;
  const filename = planRec?.attributes?.slug
    ? `${planRec.attributes.slug}resource`
    : 'resource';

  const isPassageResource = () =>
    resourceKindRef.current === ResourceTypeEnum.passageResource;
  const isProjectResource = () =>
    resourceKindRef.current === ResourceTypeEnum.projectResource;

  const { sectDesc, passDesc } = useResourceScopeLabels();

  const resourcePendingRestore = useCallback(() => {
    // Project resources should not get staged as pending uploads; they need to be configured in one go.
    if (resourceKindRef.current === ResourceTypeEnum.projectResource) {
      return undefined;
    }
    const step = InternalizationStep();
    if (!step?.id) return undefined;
    pendingResourceSeqRef.current += 1;
    return buildResourcePendingRestore({
      resourceType: resourceKindRef.current,
      sectionId: section.id,
      passageId: passage.id,
      description: descriptionRef.current || null,
      sequenceNum: rowData.length + pendingResourceSeqRef.current,
      orgWorkflowStepId: step.id,
      ...(categoryIdRef.current
        ? { artifactCategoryId: categoryIdRef.current }
        : {}),
    });
  }, [InternalizationStep, section.id, passage.id, rowData.length]);

  const hasGeneralResourceUploadConflict = (
    files: File[] = resourceUploadFiles,
    kind: ResourceTypeEnum = resourceKindRef.current
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
    files: File[] = resourceUploadFiles
  ) => {
    const descriptionReady = descriptionRequiredForResource(undefined, type)
      ? Boolean(desc.trim())
      : true;
    setResourceReady(
      descriptionReady && !hasGeneralResourceUploadConflict(files)
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
        if (isPassageResource()) {
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
        if (!isProjectResource()) {
          await AddSectionResource(
            cnt,
            descriptionRef.current,
            mediaRecId,
            isPassageResource() ? passage.id : null
          );
        } else {
          projRes.push(findRecord(memory, 'mediafile', id) as MediaFileD);
        }
      }
      if (projRes.length === 1) {
        if (areSectionsPreselectedRef.current) {
          const media = projRes[0] as MediaFileD;
          projMediaRef.current = media;
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
    cancelled.current = false;
    projMediaRef.current = undefined;
    projIdentityRef.current = [];
    setStep(WizardStep.SelectSections);
  };

  const handleSectionsSelected = (
    items: RecordIdentity[],
    candidates: RecordIdentity[]
  ) => {
    projIdentityRef.current = items;
    projCandidateRef.current = candidates;
    if (isAddingAudioResource && !projMediaRef.current) {
      // Nothing uploaded yet. Fire the held upload now. SelectSections shows a
      // spinner until afterUpload advances or re-enables it.
      const submit = submitRef.current.handleAddOrSave;
      if (!submit) return;
      areSectionsPreselectedRef.current = true;
      setUploading(true);
      void Promise.resolve(submit());
      return;
    }
    setStep(WizardStep.Configure);
  };

  // We are doing Edit flow: load the existing media into the player on mount. (Add flows
  // do this after their upload.)
  // TODO cleanup: Does this really need to be an effect? How else can we do it?
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
    projMediaRef.current = undefined;
    setResourceKind(ResourceTypeEnum.projectResource);
    artifactState.current.id = projResourceType ?? null;
    setUploadType(UploadType.ProjectResource);
    syncResourceReady(UploadType.ProjectResource, descriptionRef.current);
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
      artifactState.current.id = projResourceType ?? null;
      setUploadType(UploadType.ProjectResource);
      syncResourceReady(UploadType.ProjectResource, descriptionRef.current);
    } else if (
      artifactState.current.id === projResourceType ||
      uploadType === UploadType.ProjectResource
    ) {
      artifactState.current.id = resourceType ?? null;
      setUploadType(UploadType.Resource);
      syncResourceReady(UploadType.Resource, descriptionRef.current);
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

  // SelectSections resets its checkboxes whenever this changes. If adding a
  // resource, return the user's current selections (otherwise they'd be wiped after
  // upload). If editing, use saved assignments.
  const getInitialItems = (): RecordIdentity[] =>
    isAddingAudioResource && projIdentityRef.current.length > 0
      ? projIdentityRef.current
      : getProjectResourceAssignments(
          projMediaRef.current,
          mediafiles,
          sectionResources,
          resourceType
        );

  return {
    // strings / labels
    t,
    getOrganizedBy,
    sectDesc,
    passDesc,
    // step + title
    step,
    wizardTitle,
    isAddingAudioResource,
    // seeded upload-step values
    uploadType,
    resourceReady,
    performedBy,
    setPerformedBy,
    markdownValue,
    eafUrl: aiGenerated ? AIGenerated : '',
    filename,
    resourceUploadValidationMessage,
    resourceKind,
    resourceType,
    initCategory: categoryIdRef.current || '',
    initDescription: descriptionRef.current,
    projMedia: projMediaRef.current,
    projIdentity: projIdentityRef.current,
    projCandidate: projCandidateRef.current,
    cancelled,
    artifactState,
    addCategorySaveRef,
    submitRef,
    // section-select
    getInitialItems,
    uploading,
    // close confirm
    pendingCloseConfirmation,
    setPendingCloseConfirmation,
    onClose,
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
