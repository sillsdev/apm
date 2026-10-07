import { useState, useRef, useEffect, useCallback } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import {
  IPassageDetailArtifactsStrings,
  IMediaUploadStrings,
  Passage,
  Section,
  MediaFileD,
  MediaFile,
  SectionResourceD,
} from '../../../model';
import { PlayInPlayer } from '../../../context/PlayInPlayer';
import { useSnackBar } from '../../../hoc/SnackBar';
import Uploader from '../../Uploader';
import {
  remoteIdGuid,
  useSecResCreate,
  related,
  useOrganizedBy,
  findRecord,
  usePlan,
} from '../../../crud';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import SelectSections from './SelectSections';
import ResourceData from './ResourceData';
import { AIGenerated } from './resourceRows';
import { Box, Typography } from '@mui/material';
import { ReplaceRelatedRecord } from '../../../model/baseModel';
import ProjectResourceConfigure from './ProjectResourceConfigure';
import { useProjectResourceSave } from './useProjectResourceSave';
import Confirm from '../../AlertDialog';
import { removeExtension, isVisual, safeFileBasename } from '../../../utils';
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
import {
  getProjectResourceAssignments,
  removeUnselectedProjectResourceAssignments,
} from './projectResourceAssignments';
import { descriptionRequiredForResource } from './resourceArtifactName';
import { UploadType } from '../../UploadType';
import { ResourceTypeEnum } from './ResourceTypeEnum';
import { buildResourcePendingRestore } from './buildResourcePendingRestore';
import { useResumePendingProjectResourceConfig } from './useResumePendingProjectResourceConfig';
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

/** How the wizard was opened (see PassageDetailArtifacts). */
export type WizardLaunch =
  // Add menu: Audio / Pdf / Text / Link — enters at the upload step.
  | { kind: 'add'; action: AddUploadAction }
  // Research (FindTabs) produced markdown / a Faithbridge link — seeds the
  // upload step with that content.
  | { kind: 'markdown'; query: string; audioUrl: string; transcript: string }
  // Editing/resuming an existing general resource — enters at section select;
  // the media already exists so nothing is uploaded.
  | { kind: 'editGeneral'; media: MediaFileD };
// Editing of normal, non-general resources is handled by a separate dialog, not part of this wizard

enum WizardStep {
  None,
  Upload,
  SelectSections,
  Configure,
}

interface IProps {
  /** Pending open request from the parent; cleared via onLaunchHandled. */
  launch: WizardLaunch | null;
  onLaunchHandled: () => void;
  /** Width passed to ProjectResourceConfigure's player (desktop 1000, mobile 800). */
  configureWidth?: number;
}

/**
 * The upload-based resource flow: step 1 (Uploader) is shared by every
 * add/research path; only the General (project) resource path continues to
 * step 2 (SelectSections) and step 3 (ProjectResourceConfigure). Extracted from
 * PassageDetailArtifacts so the step state lives in one place and the step
 * components keep their own state across Back/Next.
 */
export function AddResourceWizard({
  launch,
  onLaunchHandled,
  configureWidth = 1000,
}: IProps) {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const sectionResources = useOrbitData<SectionResourceD[]>('sectionresource');
  const [memory] = useGlobal('memory');
  const [, setComplete] = useGlobal('progress');
  const [plan] = useGlobal('plan'); //will be constant here
  const { rowData, section, passage, setSelected } = usePassageDetailContext();
  const { getOrganizedBy } = useOrganizedBy();
  const { AddSectionResource, InternalizationStep } = useSecResCreate(section);
  const { getPlan } = usePlan();
  const projectResourceSave = useProjectResourceSave();
  const { showMessage } = useSnackBar();
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const tu: IMediaUploadStrings = useSelector(
    mediaUploadSelector,
    shallowEqual
  );

  const [step, setStep] = useState<WizardStep>(WizardStep.None);
  // Reported by the embedded recorder so the dialog X can't close mid-recording.
  const [recording, setRecording] = useState(false);
  // Reported by the embedded recorder: a take was recorded on the record tab
  // and not yet saved/staged, so closing the upload step must confirm (#719).
  const [uploadHasTake, setUploadHasTake] = useState(false);
  const [uploadType, setUploadType] = useState<UploadType>(UploadType.Resource);
  const [audioUploadOrRecord, setAudioUploadOrRecord] = useState(false);
  // whether we give the "general resource" option
  const [allowProject, setAllowProject] = useState(true);
  const [aiGenerated, setAIGenerated] = useState(false);
  const [markdownValue, setMarkdownValue] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [visual, setVisual] = useState(false);
  const [resourceReady, setResourceReady] = useState(true);
  const [resourceUploadFiles, setResourceUploadFiles] = useState<File[]>([]);
  const [resourceImportList, setResourceImportList] = useState<
    File[] | undefined
  >(undefined);
  const [uploading, setUploading] = useState(false);
  const [projResSetup, setProjResSetup] = useState(new Array<MediaFileD>());
  const [pendingCloseConfirmation, setPendingCloseConfirmation] =
    useState(false);
  // Whether the staged general-resource audio is a recorded take (not an
  // uploaded file). Closing the section-select step only confirms when a
  // recording would be lost; a plain file upload is cheap to redo (#719).
  const [isStagedRecording, setIsStagedRecording] = useState(false);

  const artifactState = useRef<{ id?: string | null }>({});
  const catIdRef = useRef<string | undefined>(undefined);
  const descriptionRef = useRef<string>('');
  const addCatCommitRef = useRef<(() => Promise<string>) | null>(null);
  const pendingResourceSeqRef = useRef(0);
  const cancelled = useRef(false);
  const projIdentRef = useRef<RecordIdentity[]>([]);
  /** Every passage/section the selection dialog offered; scopes cleanup. */
  const projCandidateRef = useRef<RecordIdentity[]>([]);
  const projMediaRef = useRef<MediaFileD | undefined>(undefined);
  // True when entered by adding a new audio resource ("Add Audio Resource");
  // false when configuring/editing an existing one ("Edit General Resource").
  const isAddingAudioResourceRef = useRef<boolean>(false);
  // Deferred general-resource upload: the prepared file(s) are held here and not
  // uploaded until the user picks passages/sections on SelectSections.
  const stagedResourceFilesRef = useRef<File[] | undefined>(undefined);
  // True between SelectSections' Upload and the upload completing, so afterUpload
  // routes straight to the configure step (or visual write) instead of
  // re-opening SelectSections.
  const sectionsPreselectedRef = useRef(false);

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

  const { resourceType, projResourceType } = useResourceArtifactTypes();

  const isPassageResource = () =>
    resourceKindRef.current === ResourceTypeEnum.passageResource;
  const isProjectResource = () =>
    resourceKindRef.current === ResourceTypeEnum.projectResource;

  const { sectDesc, passDesc } = useResourceScopeLabels();

  const resourcePendingRestore = useCallback(() => {
    if (resourceKindRef.current === ResourceTypeEnum.projectResource) {
      return buildResourcePendingRestore({
        resourceType: ResourceTypeEnum.projectResource,
        sectionId: section.id,
        passageId: passage.id,
        description: descriptionRef.current || null,
        sequenceNum: 0,
        ...(catIdRef.current ? { artifactCategoryId: catIdRef.current } : {}),
      });
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
      ...(catIdRef.current ? { artifactCategoryId: catIdRef.current } : {}),
    });
  }, [InternalizationStep, section.id, passage.id, rowData.length]);

  useResumePendingProjectResourceConfig({
    memory,
    mediafiles,
    setProjResSetup,
    isAddingAudioResourceRef,
  });

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

  // Tear the whole flow down (save, discard, or a terminal non-project upload).
  // No more Back is possible, so clear the category/description/filename restore
  // state kept alive while stepping through the wizard.
  const closeAll = useCallback(() => {
    setStep(WizardStep.None);
    projMediaRef.current = undefined;
    setVisual(false);
    catIdRef.current = undefined;
    descriptionRef.current = '';
    setResourceUploadFiles([]);
    setResourceKind(ResourceTypeEnum.sectionResource);
    setAudioUploadOrRecord(false);
    setAllowProject(true);
    setAIGenerated(false);
    setMarkdownValue('');
    setIsStagedRecording(false);
    stagedResourceFilesRef.current = undefined;
    sectionsPreselectedRef.current = false;
    setResourceImportList(undefined);
    setUploading(false);
    // Clear the record-only signals too: only the (audio) record panel resets
    // these via its callbacks, so without this a take from an audio flow leaves
    // uploadHasTake true and a later non-audio upload (Pdf/Text/Link) — where the
    // panel never mounts — would show a spurious discard confirm on close.
    setUploadHasTake(false);
    setRecording(false);
  }, []);

  const writeVisualResource = async (items: RecordIdentity[]) => {
    const t = new RecordTransformBuilder();
    let cnt = 0;
    const total = items.length;
    for (const i of items) {
      const rec = memory.cache.query((q) => q.findRecord(i)) as
        Passage | Section;
      const secRec =
        rec?.type === 'section'
          ? (rec as Section)
          : (memory.cache.query((q) =>
              q.findRecord({ type: 'section', id: related(rec, 'section') })
            ) as Section);
      const secNum = secRec?.attributes.sequencenum || 0;
      const topicIn =
        projMediaRef.current?.attributes?.topic ||
        removeExtension(projMediaRef.current?.attributes?.originalFile || '')
          ?.name;
      const passage = rec?.type === 'passage' ? (rec as Passage) : undefined;
      await projectResourceSave({
        t,
        media: projMediaRef.current as MediaFile,
        i: { secNum, section: secRec, passage },
        topicIn,
        limitValue: '',
        mediafiles,
        sectionResources,
      });
      cnt += 1;
      setComplete(Math.min((cnt * 100) / total, 100));
    }
    await removeUnselectedProjectResourceAssignments({
      memory,
      sourceMedia: projMediaRef.current,
      selectedItems: items,
      mediafiles,
      sectionResources,
      resourceTypeId: resourceType,
      candidateItems: projCandidateRef.current,
    });
    // Ensure setComplete(0) is always called after processing
    setComplete(0);
  };

  const afterUpload = async (_planId: string, mediaRemoteIds?: string[]) => {
    let cnt = rowData.length;
    const projRes = new Array<MediaFileD>();
    const removeMedia = new Array<RecordOperation>();
    const tr = new RecordTransformBuilder();
    let advanced = false;
    if (mediaRemoteIds && mediaRemoteIds.length > 0) {
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
        if (catIdRef.current) {
          await memory.update((t) => [
            ...ReplaceRelatedRecord(
              t,
              mediaRecId,
              'artifactCategory',
              'artifactcategory',
              catIdRef.current
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
        isAddingAudioResourceRef.current = true;
        if (sectionsPreselectedRef.current) {
          // Deferred flow: passages/sections were already chosen on
          // SelectSections (which stayed open during the upload). The upload
          // succeeded, so advance to the configure step, or write visual
          // resources directly.
          const media = projRes[0] as MediaFileD;
          projMediaRef.current = media;
          sectionsPreselectedRef.current = false;
          stagedResourceFilesRef.current = undefined;
          setResourceImportList(undefined);
          setUploading(false);
          if (isVisual(media)) {
            await writeVisualResource(projIdentRef.current);
            setVisual(false);
            closeAll();
          } else {
            // The configure step plays the context's playerMediafile; load it
            // here since this path bypasses the edit/resume entry.
            setSelected(media.id, PlayInPlayer.yes);
            setStep(WizardStep.Configure);
          }
          advanced = true;
        } else {
          // Resume-style open (Home Retry / mobile): let the projResSetup effect
          // open the section-select step.
          setProjResSetup(projRes);
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
    // button (the error was already surfaced by the uploader) and keep the
    // staged file so they can retry without re-selecting.
    if (sectionsPreselectedRef.current && projRes.length === 0) {
      sectionsPreselectedRef.current = false;
      setResourceImportList(undefined);
      setUploading(false);
      return;
    }
    // A terminal upload (section/passage resource created, or a cancelled/empty
    // upload) ends the flow.
    if (!advanced) closeAll();
  };

  // Deferred general-resource add: the Add Audio Resource dialog's Next hands
  // the prepared file here instead of uploading. We keep the file, open
  // SelectSections, and defer the real upload to that dialog's Upload button.
  const handleStageAudioFiles = async (files: File[], recorded?: boolean) => {
    // we should only have one file if going through the general resource flow
    if (!files || files.length !== 1) return;
    setIsStagedRecording(Boolean(recorded));
    // Commit a newly-typed artifact category now, while the dialog's metaData is
    // still mounted; the deferred upload runs after it unmounts.
    pendingResourceSeqRef.current = 0;
    if (addCatCommitRef.current) {
      catIdRef.current = await addCatCommitRef.current();
      addCatCommitRef.current = null;
    }
    stagedResourceFilesRef.current = files;
    // Also seed the upload-tab restore state so a recorded take — which bypasses
    // onFiles — is still pre-selected if the user Backs out and returns.
    setResourceUploadFiles(files);
    cancelled.current = false;
    isAddingAudioResourceRef.current = true;
    projMediaRef.current = undefined;
    // Fresh add: no prior selection to pre-check on SelectSections.
    projIdentRef.current = [];
    // Staging only happens for the audio → General Resource flow, so never
    // visual; the visual-vs-wizard routing in afterUpload keys off the uploaded
    // media's own type, so this only sets the SelectSections label.
    setVisual(false);
    setStep(WizardStep.SelectSections);
  };

  const handleSelectProjectResourcePassage = (
    items: RecordIdentity[],
    candidates: RecordIdentity[]
  ) => {
    projIdentRef.current = items;
    projCandidateRef.current = candidates;
    if (stagedResourceFilesRef.current) {
      // Deferred new-add flow: the file has not been uploaded yet. Upload it now
      // (headlessly, through the Uploader's importList) while SelectSections
      // stays open with its button spinner. afterUpload advances on success, or
      // re-enables the button on failure so the user can retry.
      sectionsPreselectedRef.current = true;
      setUploading(true);
      setResourceImportList(stagedResourceFilesRef.current);
      return;
    }
    if (isVisual(projMediaRef.current)) {
      writeVisualResource(items).then(() => closeAll());
    } else {
      setStep(WizardStep.Configure);
    }
  };

  // Edit/resume entry: the media already exists, so open directly at the
  // section-select step.
  const openForMedia = useCallback((m: MediaFileD) => {
    setSelected(m.id, PlayInPlayer.yes);
    projMediaRef.current = m;
    setVisual(isVisual(m));
    setStep(WizardStep.SelectSections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (projResSetup.length) {
      openForMedia(projResSetup[0] as MediaFileD);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projResSetup]);

  // When the flow leaves the section/configure steps, drop the resumed media
  // from projResSetup so it isn't reopened.
  useEffect(() => {
    if (
      step !== WizardStep.SelectSections &&
      step !== WizardStep.Configure &&
      projMediaRef.current
    )
      setProjResSetup((prev) => prev.filter((m) => m !== projMediaRef.current));
  }, [step]);

  // If SelectSections closes without starting the deferred upload (the user
  // discarded before clicking Upload), drop the staged file(s); otherwise a
  // later run would see stale files and wrongly upload them. When the upload has
  // started, sectionsPreselectedRef is true and afterUpload clears them.
  useEffect(() => {
    if (step !== WizardStep.SelectSections && !sectionsPreselectedRef.current) {
      stagedResourceFilesRef.current = undefined;
    }
  }, [step]);

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
    setAudioUploadOrRecord(true);
    setStep(WizardStep.Upload);
  };

  const handleCategory = (categoryId: string) => {
    catIdRef.current = categoryId;
  };

  const handleResourceUploadFiles = (files: File[]) => {
    setResourceUploadFiles(files);
    syncResourceReady(uploadType, descriptionRef.current, files);
  };

  const handleDescription = (desc: string) => {
    descriptionRef.current = desc;
    syncResourceReady(uploadType, desc);
  };

  const handleNonAudio = (value: boolean) => setAllowProject(!value);

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

  const handleAction = (what: AddUploadAction) => {
    artifactState.current.id = resourceType ?? null;
    setResourceKind(ResourceTypeEnum.sectionResource);
    if (what === AddResourceAction.Audio) {
      setUploadType(UploadType.Resource);
      syncResourceReady(UploadType.Resource, descriptionRef.current);
      setAudioUploadOrRecord(true);
      setStep(WizardStep.Upload);
    } else if (what === AddResourceAction.Link) {
      setUploadType(UploadType.Link);
      syncResourceReady(UploadType.Link, descriptionRef.current);
      setAudioUploadOrRecord(false);
      setStep(WizardStep.Upload);
    } else if (what === AddResourceAction.Pdf) {
      setUploadType(UploadType.PdfResource);
      syncResourceReady(UploadType.PdfResource, descriptionRef.current);
      setAllowProject(false);
      setAudioUploadOrRecord(false);
      setStep(WizardStep.Upload);
    } else if (what === AddResourceAction.Text) {
      setUploadType(UploadType.MarkDown);
      syncResourceReady(UploadType.MarkDown, descriptionRef.current);
      setAudioUploadOrRecord(false);
      setStep(WizardStep.Upload);
    }
  };

  const handleMarkdownValue = (
    query: string,
    audioUrl: string,
    transcript: string
  ) => {
    descriptionRef.current = query;
    const nextType = audioUrl
      ? UploadType.FaithbridgeLink
      : UploadType.MarkDown;
    artifactState.current.id = resourceType ?? null;
    setResourceKind(ResourceTypeEnum.sectionResource);
    setUploadType(nextType);
    syncResourceReady(nextType, query);
    setMarkdownValue(audioUrl ? `${audioUrl}||${transcript}` : transcript);
    setAudioUploadOrRecord(false);
    setAIGenerated(true);
    setStep(WizardStep.Upload);
  };

  // React to a launch request from the parent, then clear it.
  useEffect(() => {
    if (!launch) return;
    if (launch.kind === 'add') {
      handleAction(launch.action);
    } else if (launch.kind === 'markdown') {
      handleMarkdownValue(launch.query, launch.audioUrl, launch.transcript);
    } else if (launch.kind === 'editGeneral') {
      isAddingAudioResourceRef.current = false;
      openForMedia(launch.media);
    }
    onLaunchHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launch]);

  // The Uploader's close (X) calls onOpen(false); on the upload step that ends
  // the flow. A plain file upload closes without a prompt, and the record tab
  // confirms internally only when an unsaved take would be lost (#719).
  // Programmatic step changes don't fire onOpen.
  // One close handler for the whole wizard dialog. Blocks mid-recording. Only
  // confirms when something would be lost (#719): the configure step always
  // (a saved-but-unconfigured resource); the section-select step only when a
  // recording was staged (a file upload is cheap to redo); the upload step only
  // when an unsaved take sits on the record tab. Everything else closes directly.
  const handleWizardClose = (v: boolean) => {
    if (v) return;
    if (recording) return;
    const needConfirm =
      step === WizardStep.Configure ||
      (step === WizardStep.SelectSections && isStagedRecording) ||
      (step === WizardStep.Upload && uploadHasTake);
    if (needConfirm) setPendingCloseConfirmation(true);
    else closeAll();
  };

  const wizardOpen = step !== WizardStep.None;

  // Per-step dialog title. The upload step keeps the title each standalone
  // dialog used to show: "Add Audio Resource" for the audio record/upload UI, or
  // the type-specific MediaUpload title for link/pdf/text. Steps 2–3 title by
  // whether we are adding or editing a general resource.
  const uploadStepTitle = audioUploadOrRecord
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
      : isAddingAudioResourceRef.current
        ? t.addAudioResource
        : t.editGeneralResource;

  return (
    <>
      <BigDialog
        title={wizardTitle}
        description={
          step === WizardStep.SelectSections ? (
            <Typography sx={{ color: 'text.secondary' }}>
              {isAddingAudioResourceRef.current
                ? t.selectPassagesSub.replace('{0}', getOrganizedBy(false))
                : t.editingFile.replace(
                    '{0}',
                    safeFileBasename(
                      projMediaRef.current?.attributes?.originalFile
                    )
                  )}
            </Typography>
          ) : undefined
        }
        isOpen={wizardOpen}
        onOpen={handleWizardClose}
        bp={BigDialogBp.md}
        disableBackdropClose
        // Flex column so the step content fills the height and footers pin to the
        // dialog bottom.
        dialogContentSx={{ display: 'flex', flexDirection: 'column' }}
      >
        {wizardOpen ? (
          <>
            {/* Step 1: the record/upload UI, embedded (no dialog of its own) so
                it shows/hides as a step and stays mounted across the flow — a
                recorded take survives Next→Back (see PassageRecordPanel). */}
            <Box
              sx={{
                display: step === WizardStep.Upload ? 'flex' : 'none',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: 0,
              }}
            >
              <Uploader
                embedded
                onRecordingChange={setRecording}
                onHasTakeChange={setUploadHasTake}
                audioUploadOrRecord={audioUploadOrRecord}
                hideUploadCancel
                isOpen={step === WizardStep.Upload}
                // Embedded: the wizard owns visibility via `step`, and teardown
                // is driven by `finish` (completion) and `cancelReset` (cancel).
                // Closing here on the Uploader's completion onOpen(false) raced
                // afterUpload and wiped the metadata refs it needs, so this is a
                // no-op.
                onOpen={() => {}}
                showMessage={showMessage}
                multiple={true}
                finish={afterUpload}
                beforeUpload={async () => {
                  pendingResourceSeqRef.current = 0;
                  if (addCatCommitRef.current)
                    catIdRef.current = await addCatCommitRef.current();
                }}
                cancelled={cancelled}
                cancelReset={closeAll}
                artifactState={artifactState.current}
                uploadType={uploadType}
                ready={() => resourceReady}
                onNonAudio={handleNonAudio}
                performedBy={performedBy}
                onSpeakerChange={(value) => setPerformedBy(value)}
                inValue={markdownValue}
                eafUrl={aiGenerated ? AIGenerated : ''}
                defaultFilename={filename}
                pendingRestore={resourcePendingRestore}
                importList={resourceImportList}
                onFiles={handleResourceUploadFiles}
                // When returning here via Back, show the previously selected files.
                initialFiles={resourceUploadFiles}
                deferUpload={uploadType === UploadType.ProjectResource}
                onStageFiles={handleStageAudioFiles}
                validationMessage={resourceUploadValidationMessage}
                metaData={
                  <ResourceData
                    uploadType={uploadType}
                    catAllowNew={true} //if they can upload they can add cat
                    initCategory={catIdRef.current || ''}
                    onCategoryChange={handleCategory}
                    catCommitRef={addCatCommitRef}
                    initDescription={descriptionRef.current}
                    onDescriptionChange={handleDescription}
                    catRequired={false}
                    resourceKind={resourceKind}
                    onPassResChange={handlePassRes}
                    allowProject={allowProject}
                    sectDesc={sectDesc}
                    passDesc={passDesc}
                  />
                }
              />
            </Box>
            {/* Step 2: SelectSections stays mounted while the dialog is open
                (CSS-hidden on the configure step) so its selection survives Back
                from configure with no re-seeding. */}
            <Box
              sx={{
                display: step === WizardStep.SelectSections ? 'flex' : 'none',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: 0,
              }}
            >
              <SelectSections
                initialItems={
                  // The media has no saved assignments yet when adding, so
                  // re-check the prior selection (projIdentRef). Other entry
                  // points read the media's existing assignments.
                  isAddingAudioResourceRef.current &&
                  projIdentRef.current.length > 0
                    ? projIdentRef.current
                    : getProjectResourceAssignments(
                        projMediaRef.current,
                        mediafiles,
                        sectionResources,
                        resourceType
                      )
                }
                visual={visual}
                // The button uploads only when a media has not been created yet;
                // after a Back from configure the media exists, so it advances.
                uploadsOnNext={
                  isAddingAudioResourceRef.current && !projMediaRef.current
                }
                uploading={uploading}
                onSelect={handleSelectProjectResourcePassage}
                onBack={
                  isAddingAudioResourceRef.current
                    ? handleSelectSectionsBack
                    : undefined
                }
              />
            </Box>
            {/* Configure mounts only on its step: the wavesurfer player is
                expensive and its unmount clears the unsaved-changes flag. */}
            {step === WizardStep.Configure && (
              <ProjectResourceConfigure
                // Exceeds the md dialog's inner width so the player's
                // maxWidth:100% clamps it to fill, extending the waveform to the
                // dialog's edge.
                width={configureWidth}
                media={projMediaRef.current}
                items={projIdentRef.current}
                candidateItems={projCandidateRef.current}
                resourceTypeId={resourceType}
                onOpen={closeAll}
                onBack={
                  isAddingAudioResourceRef.current
                    ? handleConfigureBack
                    : undefined
                }
              />
            )}
          </>
        ) : (
          <></>
        )}
      </BigDialog>
      {pendingCloseConfirmation && (
        <Confirm
          title={t.confirmCloseTitle}
          text={t.confirmClose}
          no={t.keepOpen}
          primaryButton="no"
          yes={t.discardAndClose}
          noResponse={() => setPendingCloseConfirmation(false)}
          yesResponse={() => {
            setPendingCloseConfirmation(false);
            closeAll();
          }}
        />
      )}
    </>
  );
}

export default AddResourceWizard;
