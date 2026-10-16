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

/**
 * The AddResourceActions this wizard owns — the upload-based ones. Shared and
 * Scripture are different mechanisms (no Uploader) and stay with the parent, so
 * they are deliberately excluded here.
 */
export type AddUploadAction =
  | AddResourceAction.Audio
  | AddResourceAction.Pdf
  | AddResourceAction.Text
  | AddResourceAction.Link;

/** Which action opened the wizard (see PassageDetailArtifacts). */
export type WizardLaunch =
  // Add menu: Audio / Pdf / Text / Link — enters at the upload step.
  | { kind: 'add'; action: AddUploadAction }
  // Research (FindTabs) produced markdown / a Faithbridge link — seeds the
  // upload step with that content.
  // TODO test and rename this branch
  | { kind: 'markdown'; query: string; audioUrl: string; transcript: string }
  // Editing/resuming an existing general resource — enters at section select;
  // the media already exists so nothing is uploaded.
  | { kind: 'editGeneralResource'; media: MediaFileD };
// Editing of normal, non-general resources is handled by a separate dialog, not part of this wizard

// Step reachability by launch kind (which steps a given entry can ever show):
//   add (Audio)            Upload → SelectSections → Configure (general resource),
//                          or Upload-terminal (section/passage resource)
//   add (Pdf/Text/Link)    Upload-terminal
//   editGeneralResource    SelectSections → Configure
//                          (NEVER Upload, there is no Back out of SelectSections unless isAddingAudioResource)
export enum WizardStep {
  Upload,
  SelectSections,
  Configure,
}

// Registered with the Unsaved context whenever closing the wizard would lose
// work (the same states that confirm on the dialog's own X), so a browser/app
// close (beforeunload) raises the usual unsaved-changes warning too. This is a
// close-guard only — nothing saves it; it just lights up the global `changed`
// flag. Distinct from ProjectResourceConfigure's save tool ('AddResourceWizard-Save'),
// which actually persists the configure step.
const wizardCloseGuardToolId = 'AddResourceWizard-CloseGuard';

interface IUseAddResourceWizardProps {
  /** Which action opened the wizard; read once at mount to seed state. */
  launchSource: WizardLaunch;
  /** Asked to close (cancel, finish, or discard). The parent stops rendering
   *  the wizard, which unmounts it; the next open mounts it fresh. */
  onClose: () => void;
}

/**
 * All state, derived values, side-effects and handlers for the AddResourceWizard
 * view. The step state lives in one place and the step components keep their own
 * state across Back/Next; see AddResourceWizard for the rendered steps.
 */
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
  const { toolChanged } = useContext(UnsavedContext).state;
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const tu: IMediaUploadStrings = useSelector(
    mediaUploadSelector,
    shallowEqual
  );

  const { resourceType, projResourceType } = useResourceArtifactTypes();

  // All launch-derived state is seeded synchronously from launchSource, which is
  // fixed for this mount — the parent renders the wizard only while open, so each
  // open is a fresh mount. There is no "closed" step and no post-mount launch
  // effect to reconcile. Each ternary tests launchSource.kind directly so
  // TypeScript narrows the union. initUploadType/initDescription are shared
  // because resourceReady derives from both.
  const initUploadType: UploadType =
    launchSource.kind === 'editGeneralResource'
      ? UploadType.Resource
      : launchSource.kind === 'markdown'
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
    launchSource.kind === 'markdown' ? launchSource.query : '';

  const [step, setStep] = useState<WizardStep>(
    launchSource.kind === 'editGeneralResource'
      ? WizardStep.SelectSections
      : WizardStep.Upload
  );
  // Sticky: set once a recording starts on the record tab this session and never
  // cleared until the wizard remounts. It is the single "an unsaved recording
  // could be lost" signal that gates the close confirm on both the upload and
  // section-select steps (#719). Sticky deliberately over-confirms rather than
  // risk discarding a recording silently: if the user records, then discards or
  // switches to a plain file upload, closing still prompts — a rare path where an
  // extra confirm is harmless. Closing
  // mid-recording confirms, then unmounts the recorder, and
  // useWavRecorder stops the mic on unmount — so there is no separate block.
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [uploadType, setUploadType] = useState<UploadType>(initUploadType);
  // The "Add Audio Resource" flow (add + Audio launch). Fixed by the launch
  // source, so it never changes while mounted.
  const isAddingAudioResource =
    launchSource.kind === 'add' &&
    launchSource.action === AddResourceAction.Audio;
  // Seeded once from the launch source; never change while mounted.
  const aiGenerated = launchSource.kind === 'markdown';
  const markdownValue =
    launchSource.kind === 'markdown'
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

  const cancelled = useRef(false); // TODO rename

  // --- Deferred upload ---
  // The wizard chooses the file/take in the upload step but fires the real
  // upload later from the SelectSections step. These refs hold the
  // payload and control handles across that gap, so the deferred callbacks read
  // the latest values without a stale closure and without forcing a re-render.
  const artifactState = useRef<{ id?: string | null }>({
    // The edit flow reuses the media's existing type; the add/markdown flows
    // create a new plain resource.
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
  // Handle to the upload step's active tab. In the deferred general-resource
  // flow the chosen file (or recorded take) stays in the upload step, which
  // remains mounted. SelectSections' Upload button calls this to upload it.
  const submitRef = useRef<MediaUploadControlsRef>({
    handleAddOrSave: null,
    handleCancel: null,
  });
  // True between SelectSections' Upload and the upload completing, so afterUpload
  // routes straight to the configure step instead of re-opening SelectSections.
  // TODO I don't understand the comment above, check on this
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
    // Project resources are configured in one go through the wizard, not staged
    // as pending uploads.
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
      // Both callers resolve these remote ids before calling us: the file tab
      // through useMediaUpload.run()'s pull-then-finish, and the record tab
      // through MediaRecord's own useMediaUpload `finish` (also post-pull). So
      // remoteIdGuid below always finds the just-uploaded mediafile.
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
          // Deferred flow: passages/sections were already chosen on
          // SelectSections (which stayed open during the upload). The upload
          // succeeded, so advance to the configure step.
          const media = projRes[0] as MediaFileD;
          projMediaRef.current = media;
          areSectionsPreselectedRef.current = false;
          setUploading(false);
          // The configure step plays the context's playerMediafile; load it
          // here since this path bypasses the edit/resume entry.
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
    // Deferred upload produced no media (the upload failed). SelectSections is
    // still open with the user's selection intact, so just re-enable its Upload
    // button (the error was already surfaced by the uploader). The upload step
    // still holds the file/take, so the user can retry without re-selecting.
    if (areSectionsPreselectedRef.current && projRes.length === 0) {
      areSectionsPreselectedRef.current = false;
      setUploading(false);
      return;
    }
    // A terminal upload (section/passage resource created, or a cancelled/empty
    // upload) ends the flow.
    if (!advanced) onClose();
  };

  // The upload step's `beforeUpload`: commit the staged category (if any) just
  // before the real upload fires. The artifact category is committed here, not
  // when the wizard advances.
  const handleBeforeUpload = async () => {
    pendingResourceSeqRef.current = 0;
    if (addCategorySaveRef.current) {
      categoryIdRef.current = await addCategorySaveRef.current();
      // Null it so a retry (SelectSections Upload again after a
      // failure) can't re-commit and create a duplicate category.
      addCategorySaveRef.current = null;
    }
  };

  // Deferred general-resource add: the Add Audio Resource step's Next
  // advances to SelectSections but holds on to the prepared file / recorded take and stays mounted but hidden.
  // The real upload fires later from SelectSections via `submitRef`. The artifact category is committed by the
  // step's `beforeUpload` at that real upload, not here.
  const handleUploadStepNext = () => {
    cancelled.current = false;
    projMediaRef.current = undefined;
    // Fresh add: no prior selection to pre-check on SelectSections.
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
      // Deferred new-add flow: nothing uploaded yet. Trigger the upload step's
      // retained selection now — it stayed mounted (hidden) with its file/take,
      // so SelectSections stays open with its button spinner while the upload
      // runs. afterUpload advances on success, or re-enables the button on
      // failure so the user can retry without re-selecting.
      const submit = submitRef.current.handleAddOrSave;
      if (!submit) return;
      areSectionsPreselectedRef.current = true;
      setUploading(true);
      void Promise.resolve(submit());
      return;
    }
    setStep(WizardStep.Configure);
  };

  // Edit/resume entry: the media already exists (seeded into projMediaRef by
  // launchInit, opening at SelectSections). Load it into the player once on
  // mount — the add flows call setSelected later, after their upload.
  useEffect(() => {
    if (launchSource.kind === 'editGeneralResource') {
      setSelected(launchSource.media.id, PlayInPlayer.yes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Configure step "Back" (add flow only): return to section selection keeping
  // the uploaded media. SelectSections never unmounted (CSS-hidden under the
  // same dialog), so its selection is preserved with no re-seeding.
  const handleConfigureBack = () => setStep(WizardStep.SelectSections);

  // SelectSections "Back" (add flow only): return to the upload/record dialog to
  // change the audio file. A media already uploaded is left in place; uploading
  // a replacement creates a new general resource and leaves the prior one — the
  // same outcome as cancelling from the configure step.
  const handleSelectSectionsBack = () => {
    projMediaRef.current = undefined;
    setResourceKind(ResourceTypeEnum.projectResource);
    artifactState.current.id = projResourceType ?? null;
    setUploadType(UploadType.ProjectResource);
    syncResourceReady(UploadType.ProjectResource, descriptionRef.current);
    // isAddingAudioResource is already true here (this Back is reachable only in
    // the add-Audio flow), so there is nothing to set.
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

  // The Uploader's close (X) calls onOpen(false); on the upload step that ends
  // the flow. Programmatic step changes don't fire onOpen.
  // One close handler for the whole wizard dialog. Only confirms when something
  // would be lost (#719): the configure step always (a saved-but-unconfigured
  // resource); the upload and section-select steps whenever a recording has
  // started this session (recordingStarted) — a plain file upload is cheap to
  // redo and never sets that flag, so it closes directly. Closing mid-recording
  // takes the same confirm path, not a block. Everything else closes directly.
  const needConfirmClose =
    step === WizardStep.Configure ||
    ((step === WizardStep.Upload || step === WizardStep.SelectSections) &&
      recordingStarted);

  const handleWizardClose = (v: boolean) => {
    if (v) return;
    if (needConfirmClose) setPendingCloseConfirmation(true);
    else onClose();
  };

  // Those same states should also fire the usual unsaved-changes warning on a
  // browser/app close, so register a changed tool while one is showing (AppHead's
  // beforeunload reads the global `changed` flag). This covers every confirm
  // state, Configure included, so app-close matches the dialog X exactly.
  // ProjectResourceConfigure's own (save-capable) tool is separate and coexists
  // during Configure edits. Nothing persists this guard on a save-all, but that
  // path is unreachable while the wizard's modal dialog is open — the only exit
  // is the dialog's own confirm-gated close.
  useEffect(() => {
    toolChanged(wizardCloseGuardToolId, needConfirmClose);
    return () => toolChanged(wizardCloseGuardToolId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needConfirmClose]);

  // Per-step dialog title. The upload step keeps the title each standalone
  // dialog used to show: "Add Audio Resource" for the audio record/upload UI, or
  // the type-specific MediaUpload title for link/pdf/text. Steps 2–3 title by
  // whether we are adding or editing a general resource.
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

  // Initial selection for SelectSections. The media has no saved assignments yet
  // when adding, so re-check the prior selection (projIdentityRef). Other entry
  // points read the media's existing assignments.
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
    // refs shared across steps
    cancelled,
    artifactState,
    categoryIdRef,
    descriptionRef,
    addCategorySaveRef,
    projMediaRef,
    projIdentityRef,
    projCandidateRef,
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
