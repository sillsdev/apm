import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useGetGlobal, useGlobal } from '../../../context/useGlobal';
import {
  IPassageDetailArtifactsStrings,
  Passage,
  Section,
  MediaFileD,
  SectionResourceD,
  MediaFile,
  ArtifactType,
  Resource,
  SheetLevel,
  ISharedStrings,
} from '../../../model';
import { arrayMoveImmutable as arrayMove } from 'array-move';
import { PlayInPlayer } from '../../../context/PlayInPlayer';
import { useSnackBar } from '../../../hoc/SnackBar';
import Uploader from '../../Uploader';
import AddResource from './AddResource';
import SortableHeader from './SortableHeader';
import { IRow } from '../../../context/PassageDetailContext';
import { Button } from '../../../control';
import { AIGenerated, SortableItem } from '.';
import {
  remoteIdGuid,
  useSecResCreate,
  useMediaResCreate,
  useSecResUpdate,
  useSecResDelete,
  related,
  useSecResUserCreate,
  useSecResUserRead,
  useSecResUserDelete,
  useOrganizedBy,
  findRecord,
  useArtifactCategory,
  IArtifactCategory,
  ArtifactCategoryType,
  usePlanType,
  usePlan,
} from '../../../crud';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import MediaDisplay from '../../MediaDisplay';
import SelectSharedResource from './SelectSharedResource';
import SelectProjectResource from './SelectProjectResource';
import SelectSections from './SelectSections';
import ResourceData from './ResourceData';
import { MarkDownType, UriLinkType } from '../../MediaUpload';
import LimitedMediaPlayer from '../../LimitedMediaPlayer';
import {
  canSaveResourceEdit,
  descriptionRequiredForResource,
} from './resourceArtifactName';
import {
  Badge,
  Box,
  BoxProps,
  Grid,
  Stack,
  styled,
  Typography,
  useTheme,
} from '@mui/material';
import { ReplaceRelatedRecord } from '../../../model/baseModel';
import { PassageResourceButton } from './PassageResourceButton';
import ProjectResourceConfigure from './ProjectResourceConfigure';
import { useProjectResourceSave } from './useProjectResourceSave';
import Confirm from '../../AlertDialog';
import {
  getSegments,
  NamedRegions,
  removeExtension,
  isVisual,
  isUrl,
  useMobile,
} from '../../../utils';
import { useOrbitData } from '../../../hoc/useOrbitData';
import {
  RecordIdentity,
  RecordKeyMap,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';
import { shallowEqual, useSelector } from 'react-redux';
import {
  passageDetailArtifactsSelector,
  sharedSelector,
} from '../../../selector';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { PassageTypeEnum } from '../../../model/passageType';
import { VertListDnd } from '../../../hoc/VertListDnd';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { LaunchLink } from '../../../control/LaunchLink';
import {
  getProjectResourceAssignments,
  removeUnselectedProjectResourceAssignments,
} from './projectResourceAssignments';
import FindTabs from './FindTabs';
import { storedCompareKey } from '../../../utils/storedCompareKey';
import { mediaContentType } from '../../../utils/contentType';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { isLinkedNote } from '../../../crud/isLinkedNote';
import FindBibleBrain from './FindBibleBrain';
import { useHandleLink } from './addLinkKind';
import { usePassageRef } from './usePassageRef';
import { MarkDownView } from '../../../control/MarkDownView';
import { UploadType } from '../../UploadType';
import { ResourceTypeEnum } from './ResourceTypeEnum';
import { buildResourcePendingRestore } from './buildResourcePendingRestore';
import { useResumePendingProjectResourceConfig } from './useResumePendingProjectResourceConfig';
import { AddResourceAction } from './AddResourceAction';

const MediaContainer = styled(Box)<BoxProps>(({ theme }) => ({
  marginRight: theme.spacing(2),
  marginTop: theme.spacing(1),
  width: '100%',
  '& audio': {
    height: '40px',
    display: 'flex',
    width: 'inherit',
  },
}));

export function PassageDetailArtifacts() {
  const theme = useTheme();
  const sectionResources = useOrbitData<SectionResourceD[]>('sectionresource');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const artifactTypes = useOrbitData<ArtifactType[]>('artifacttype');
  const [memory] = useGlobal('memory');
  const [busy, setBusy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [remoteBusy] = useGlobal('remoteBusy'); //verified this is not used in a function 2/18/25
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [, setComplete] = useGlobal('progress');
  const {
    rowData,
    section,
    passage,
    setSelected,
    playItem,
    setPlayItem,
    setMediaSelected,
    itemPlaying,
    setItemPlaying,
    currentstep,
    toggleDone,
    forceRefresh,
    handleItemPlayEnd,
    handleItemTogglePlay,
    getProjectResources,
    sharedResource,
  } = usePassageDetailContext();
  const { getOrganizedBy } = useOrganizedBy();
  const { AddSectionResource, InternalizationStep } = useSecResCreate(section);
  const AddSectionResourceUser = useSecResUserCreate();
  const ReadSectionResourceUser = useSecResUserRead();
  const RemoveSectionResourceUser = useSecResUserDelete();
  const AddMediaFileResource = useMediaResCreate(passage, currentstep);
  const UpdateSectionResource = useSecResUpdate();
  const DeleteSectionResource = useSecResDelete();
  const { getArtifactCategorys } = useArtifactCategory();
  const catRef = useRef<IArtifactCategory[]>([]);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [aiGenerated, setAIGenerated] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [visual, setVisual] = useState(false);
  const [sortKey, setSortKey] = useState(0);
  const cancelled = useRef(false);
  const [displayId, setDisplayId] = useState('');
  const [link, setLink] = useState<string>();
  const [markDown, setMarkDoan] = useState('');
  const [audioScriptureVisible, setAudioScriptureVisible] = useState(false);
  const [allowProject, setAllowProject] = useState(true);
  const [sharedResourceVisible, setSharedResourceVisible] = useState(false);
  const [projectResourceVisible, setProjectResourceVisible] = useState(false);
  const [projResPassageVisible, setProjResPassageVisible] = useState(false);
  const [projResWizVisible, setProjResWizVisible] = useState(false);
  const [projResSetup, setProjResSetup] = useState(new Array<MediaFileD>());
  const [editResource, setEditResource] = useState<
    SectionResourceD | undefined
  >();
  const [allowEditSave, setAllowEditSave] = useState(false);
  const [resourceReady, setResourceReady] = useState(true);
  const [resourceUploadFiles, setResourceUploadFiles] = useState<File[]>([]);
  const [artifactState] = useState<{ id?: string | null }>({});
  // const [artifactTypeId, setArtifactTypeId] = useState<string>();
  const [uploadType, setUploadType] = useState<UploadType>(UploadType.Resource);
  const [audioUploadOrRecord, setAudioUploadOrRecord] =
    useState<boolean>(false);
  const [editAudio, setEditAudio] = useState<boolean>(false);
  const mediaRef = useRef<MediaFileD | undefined>(undefined);
  const textRef = useRef<string | undefined>(undefined);
  const catIdRef = useRef<string | undefined>(undefined);
  // commit() handles for the two SelectArtifactCategory instances (edit dialog
  // vs. the add/upload dialog). Kept separate so one dialog unmounting never
  // clears the other's handle. Called at save to create a new category.
  const editCatCommitRef = useRef<(() => Promise<string>) | null>(null);
  const addCatCommitRef = useRef<(() => Promise<string>) | null>(null);
  const descriptionRef = useRef<string>('');
  const pendingResourceSeqRef = useRef(0);

  const [resourceKind, setResourceKindx] = useState(
    ResourceTypeEnum.sectionResource
  );
  const resourceKindRef = useRef(resourceKind);
  const setResourceKind = (kind: ResourceTypeEnum) => {
    resourceKindRef.current = kind;
    setResourceKindx(kind);
  };
  const projIdentRef = useRef<RecordIdentity[]>([]);
  /** Every passage/section the selection dialog offered; scopes cleanup. */
  const projCandidateRef = useRef<RecordIdentity[]>([]);
  const projMediaRef = useRef<MediaFileD | undefined>(undefined);
  // True when the general-resource wizard was entered by adding a new audio
  // resource ("Add Audio Resource"); false when configuring/editing an existing
  // one ("Edit Audio Resource").
  const isAddingAudioResourceRef = useRef<boolean>(false);
  // Deferred general-resource upload: the prepared file(s) are held here and not
  // uploaded until the user picks passages/sections on SelectSections.
  const stagedResourceFilesRef = useRef<File[] | undefined>(undefined);
  // True between SelectSections' Upload and the upload completing, so afterUpload
  // routes straight to the configure step (or visual write) instead of
  // re-opening SelectSections.
  const sectionsPreselectedRef = useRef(false);
  // Drives the deferred (headless) upload through the always-mounted Uploader.
  const [resourceImportList, setResourceImportList] = useState<
    File[] | undefined
  >(undefined);
  // True while the general-resource upload runs. SelectSections stays open
  // (selections preserved) with its Upload button disabled/spinner until the
  // upload succeeds (advance to the wizard) or fails (re-enable for retry).
  const [uploading, setUploading] = useState(false);
  const [allResources, setAllResources] = useState(false);
  const { showMessage } = useSnackBar();
  const [confirm, setConfirm] = useState('');
  const [mediaStart, setMediaStart] = useState<number | undefined>();
  const [mediaEnd, setMediaEnd] = useState<number | undefined>();
  const [performedBy, setPerformedBy] = useState('');
  const [markdownValue, setMarkdownValue] = useState('');
  const projectResourceSave = useProjectResourceSave();
  const { removeKey } = storedCompareKey(passage, section);
  const [plan] = useGlobal('plan'); //will be constant here
  const planType = usePlanType();
  const { getPlan } = usePlan();
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { canDoSectionStep } = useStepPermissions();
  const hasPermission =
    canDoSectionStep(currentstep, section) &&
    !isLinkedNote(passage, sharedResource);
  const modifiable = useMemo(
    () => hasPermission && (!offline || offlineOnly),
    [hasPermission, offline, offlineOnly]
  );
  const [biblebrainClose, setBiblebrainClose] = useState(false);
  // Confirm-before-discard for the passage-select and edit dialogs. Closing any
  // step of this wizard flow always prompts, since it discards everything
  // entered on this and prior steps.
  // Which dialog's close is awaiting confirmation ('passage' vs 'edit' differ
  // only in what discarding tears down); null when no prompt is showing.
  const [dialogPendingCloseConfirmation, setDialogPendingCloseConfirmation] =
    useState<null | 'passage' | 'edit' | 'wiz'>(null);
  const getGlobal = useGetGlobal();
  const handleLink = useHandleLink({ passage, setLink });
  const { passageRef } = usePassageRef();

  const planRec = plan ? getPlan(plan) : null;
  const filename = planRec?.attributes?.slug
    ? `${planRec.attributes.slug}resource`
    : 'resource';

  const resourceType = useMemo(() => {
    const resourceType = artifactTypes.find(
      (t) =>
        t.attributes?.typename === 'resource' &&
        Boolean(t?.keys?.remoteId) === !offlineOnly
    );
    // setArtifactTypeId(resourceType?.id);
    artifactState.id = resourceType?.id || null;
    return resourceType?.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactTypes, offlineOnly]);

  const otherResourcesAvailable = useMemo(
    () => rowData.some((r) => r.passageId && r.passageId !== passage.id),
    [passage, rowData]
  );

  const handleNonAudio = (value: boolean) => setAllowProject(!value);

  const isPassageResource = () =>
    resourceKindRef.current === ResourceTypeEnum.passageResource;
  const isProjectResource = () =>
    resourceKindRef.current === ResourceTypeEnum.projectResource;

  const projResourceType = useMemo(() => {
    const resourceType = artifactTypes.find(
      (t) =>
        t.attributes?.typename === 'projectresource' &&
        Boolean(t?.keys?.remoteId) === !offlineOnly
    );
    return resourceType?.id;
  }, [artifactTypes, offlineOnly]);

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

  const handlePlay = (id: string) => {
    if (id === playItem) {
      setItemPlaying(!itemPlaying);
    } else {
      const row = rowData.find((r) => r.id === id);
      if (row) {
        const segs = getSegments(
          NamedRegions.ProjectResource,
          row.mediafile.attributes.segments
        );
        const regions = JSON.parse(segs);
        if (regions.length > 0) {
          const { start, end } = regions[0];
          setMediaStart(start);
          setMediaEnd(end);
          setMediaSelected(id, start, end);
          return;
        } else {
          setMediaStart(undefined);
          setMediaEnd(undefined);
        }
      }
      setSelected(id, PlayInPlayer.no);
    }
  };

  const handleDisplayId = (id: string) => {
    setDisplayId(id);
  };

  const handleFinish = () => {
    setDisplayId('');
  };

  const handleLinkId = (id: string) => {
    setLink(
      rowData.find((r) => r.id === id)?.mediafile?.attributes?.originalFile
    );
  };

  const handleMarkDownId = (id: string) => {
    setMarkDoan(
      rowData.find((r) => r.id === id)?.mediafile?.attributes?.originalFile ??
        ''
    );
  };

  const handleDone = async (id: string, res: SectionResourceD | null) => {
    if (!res) return;
    const rec = await ReadSectionResourceUser(res);
    if (rec !== null) {
      await RemoveSectionResourceUser(res, rec);
    } else {
      await AddSectionResourceUser(res);
    }
    toggleDone(id);
    setTimeout(() => {
      setBusy(true);
      forceRefresh();
      setTimeout(() => setBusy(false), 500);
    }, 500);
  };

  const handleDelete = (id: string) => setConfirm(id);
  const handleDeleteRefused = () => setConfirm('');
  const handleDeleteConfirmed = () => {
    setBusy(true);
    const secRes = sectionResources.find(
      (r) => related(r, 'mediafile') === confirm
    );
    if (secRes) {
      removeKey(related(secRes, 'mediafile'));
      DeleteSectionResource(secRes);
    }
    setConfirm('');
    setBusy(false);
  };
  const handleUploadVisible = (v: boolean) => {
    setUploadVisible(v);
  };

  const handleFindVisible = (v: boolean) => {
    setFindOpen(v);
  };

  const handleSharedResourceVisible = (v: boolean) => {
    setSharedResourceVisible(v);
  };

  const handleProjectResourceVisible = (v: boolean) => {
    const complete = getGlobal('progress');
    if (complete === 0 || complete === 100) {
      setProjectResourceVisible(v);
    }
  };

  const handleProjResPassageVisible = (v: boolean) => {
    if (!v) {
      setDialogPendingCloseConfirmation('passage');
      return;
    }
    setProjResPassageVisible(v);
  };
  const handlePassageDiscard = () => {
    setDialogPendingCloseConfirmation(null);
    setProjResPassageVisible(false);
    // A genuine abandon (not a Back), unlike handleWizBack/handlePassageBack — clear
    // the restore state so the next fresh Add Audio Resource does not inherit it.
    catIdRef.current = undefined;
    descriptionRef.current = '';
    setResourceUploadFiles([]);
  };

  // The wizard's X routes here (like the passage-select dialog): a close request
  // opens the shared discard confirm; opening just shows the dialog.
  const handleProjResWizVisible = (v: boolean) => {
    if (!v) {
      setDialogPendingCloseConfirmation('wiz');
      return;
    }
    setProjResWizVisible(v);
  };
  // Actually hide the wizard dialog. Called on discard (handleWizDiscard) and
  // when a save finishes (ProjectResourceConfigure's onOpen). Confirm-on-close is
  // parent-owned via dialogPendingCloseConfirmation='wiz'.
  const closeProjResWiz = () => {
    setProjResWizVisible(false);
    projMediaRef.current = undefined;
    setVisual(false);
    // The wizard is truly done (save or discard) — no more Back is possible, so
    // clear the category/description/filename restore state kept alive by
    // resetEdit's preserveResourceForm since the upload succeeded.
    catIdRef.current = undefined;
    descriptionRef.current = '';
    setResourceUploadFiles([]);
  };
  const handleWizDiscard = () => {
    setDialogPendingCloseConfirmation(null);
    closeProjResWiz();
  };

  // Configure step "Back" (add flow only): return to passage selection keeping
  // the uploaded media (unlike closeProjResWiz, which discards it). No confirm —
  // going back is not a close; the wizard clears its own dirty flag on unmount,
  // and the prior selection is re-checked via SelectSections' initialItems
  // (projIdentRef). Coming forward again just re-opens the wizard (no re-upload,
  // since the media already exists).
  const handleWizBack = () => {
    setProjResWizVisible(false);
    setProjResPassageVisible(true);
  };

  const handlePassageBack = () => {
    // Back to the upload/record dialog to change the audio file. A media already
    // uploaded (reached here from the configure step's Back) is left in place;
    // uploading a replacement creates a new general resource and leaves the prior
    // one — the same outcome as cancelling from the configure step. Preventing
    // these orphans is not priority for us at this time.
    setProjResPassageVisible(false);
    projMediaRef.current = undefined;
    // Reopen the Add Audio Resource upload dialog in general-resource mode, the
    // same state the user staged the file from.
    setResourceKind(ResourceTypeEnum.projectResource);
    artifactState.id = projResourceType ?? null;
    setUploadType(UploadType.ProjectResource);
    syncResourceReady(UploadType.ProjectResource, descriptionRef.current);
    setAudioUploadOrRecord(true);
    setUploadVisible(true);
  };

  const handleAllResources = () => {
    setAllResources(!allResources);
  };

  const handleEdit = (id: string) => {
    const secRes = sectionResources.find(
      (r) => related(r, 'mediafile') === id
    ) as SectionResourceD;
    const mf = mediafiles.find((m) => m.id === related(secRes, 'mediafile')) as
      MediaFileD | undefined;
    const sourceMedia = mediafiles.find(
      (m) => m.id === related(mf, 'sourceMedia')
    );
    // Resolve to the root general resource. When a derived copy is clicked, edit
    // its source; only fall back to the clicked media when it is itself the
    // general resource. Derived copies use the `resource` type (not
    // `projectresource`), so in practice only one branch matches, but preferring
    // the source guards against ever treating a derived copy as a new source
    // (which would spawn a second-generation chain).
    const projectMedia =
      sourceMedia && related(sourceMedia, 'artifactType') === projResourceType
        ? sourceMedia
        : mf && related(mf, 'artifactType') === projResourceType
          ? mf
          : undefined;
    // General (project) resources are reconfigured through the wizard, not the
    // simple edit dialog (mockup: "use Edit to also configure the General Resource").
    if (projectMedia) {
      setResourceKind(ResourceTypeEnum.projectResource);
      isAddingAudioResourceRef.current = false;
      handleSelectProjectResource(projectMedia);
      return;
    }
    setEditResource(secRes);
    setResourceKind(
      related(secRes, 'passage')
        ? ResourceTypeEnum.passageResource
        : ResourceTypeEnum.sectionResource
    );
    descriptionRef.current = secRes?.attributes.description || '';
    catIdRef.current = mf ? related(mf, 'artifactCategory') : undefined;
    mediaRef.current = mf as MediaFileD;
    const ct = mediaContentType(mf);
    textRef.current = mf?.attributes?.originalFile ?? '';
    setEditAudio(ct.startsWith('audio'));
    setUploadType(
      ct === MarkDownType
        ? UploadType.MarkDown
        : ct === UriLinkType
          ? UploadType.Link
          : UploadType.Resource
    );
    setAllowEditSave(
      canSaveResourceEdit({
        contentType: ct,
        description: descriptionRef.current,
        text: textRef.current ?? '',
        originalFile: mf?.attributes?.originalFile,
        isUrl,
      })
    );
  };
  // preserveResourceForm: skip clearing the category/description/filename restore
  // state. Used when the deferred general-resource upload succeeds and the wizard
  // advances to the configure step — Back/Back from there must still return the
  // user to an upload dialog seeded with what they already entered.
  const resetEdit = (preserveResourceForm = false) => {
    setEditResource(undefined);
    if (!preserveResourceForm) {
      catIdRef.current = undefined;
      descriptionRef.current = '';
      setResourceUploadFiles([]);
    }
    setResourceKind(ResourceTypeEnum.sectionResource);
    setUploadVisible(false);
    setMarkdownValue('');
    setAIGenerated(false);
    setAudioUploadOrRecord(false);
    setAllowProject(true);
    setEditAudio(false);
  };
  const handleEditResourceVisible = (v: boolean) => {
    // The X routes here (backdrop close is disabled); always confirm before discarding.
    if (!v) {
      setDialogPendingCloseConfirmation('edit');
    }
  };
  const handleEditSave = async () => {
    // Create the category now (at save) if the user typed a new one; on blur it
    // was only resolved against existing categories.
    if (editCatCommitRef.current) {
      const catId = await editCatCommitRef.current();
      catIdRef.current = catId;
    }
    if (editResource) {
      UpdateSectionResource({
        ...editResource,
        attributes: {
          ...editResource.attributes,
          description: descriptionRef.current,
        },
      });
      if (Boolean(related(editResource, 'passage')) !== isPassageResource()) {
        await memory.update((t) => [
          ...ReplaceRelatedRecord(
            t,
            editResource,
            'passage',
            'passage',
            isPassageResource() ? passage.id : ''
          ),
        ]);
      }
      const mf = mediafiles.find(
        (m) => m.id === related(editResource, 'mediafile')
      ) as MediaFileD | undefined;
      if (mf && textRef.current) {
        await memory.update((t) => [
          t.replaceAttribute(mf, 'originalFile', textRef.current),
        ]);
      }
      if (mf && catIdRef.current) {
        await memory.update((t) => [
          ...ReplaceRelatedRecord(
            t,
            mf,
            'artifactCategory',
            'artifactcategory',
            catIdRef.current
          ),
        ]);
      }
      if (mf && isPassageResource() !== Boolean(related(mf, 'passage'))) {
        await memory.update((t) => [
          ...ReplaceRelatedRecord(
            t,
            mf,
            'passage',
            'passage',
            isPassageResource() ? passage.id : ''
          ),
        ]);
      }
    }
    resetEdit();
  };
  const handleEditCancel = () => {
    setDialogPendingCloseConfirmation('edit');
  };
  const handleEditDiscard = () => {
    setDialogPendingCloseConfirmation(null);
    resetEdit();
  };
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

  const handleAction = (what: AddResourceAction) => {
    artifactState.id = resourceType ?? null;
    setResourceKind(ResourceTypeEnum.sectionResource);
    if (what === AddResourceAction.Audio) {
      mediaRef.current = undefined;
      setUploadType(UploadType.Resource);
      syncResourceReady(UploadType.Resource, descriptionRef.current);
      setAudioUploadOrRecord(true);
      setUploadVisible(true);
    } else if (what === AddResourceAction.Scripture) {
      setAudioScriptureVisible(true);
    } else if (what === AddResourceAction.Link) {
      setUploadType(UploadType.Link);
      syncResourceReady(UploadType.Link, descriptionRef.current);
      setAudioUploadOrRecord(false);
      setUploadVisible(true);
    } else if (what === AddResourceAction.Pdf) {
      mediaRef.current = undefined;
      setUploadType(UploadType.PdfResource);
      syncResourceReady(UploadType.PdfResource, descriptionRef.current);
      setAllowProject(false);
      setAudioUploadOrRecord(false);
      setUploadVisible(true);
    } else if (what === AddResourceAction.Text) {
      setUploadType(UploadType.MarkDown);
      syncResourceReady(UploadType.MarkDown, descriptionRef.current);
      setAudioUploadOrRecord(false);
      setUploadVisible(true);
    } else if (what === AddResourceAction.Shared) {
      setResourceKind(ResourceTypeEnum.sectionResource);
      setSharedResourceVisible(true);
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
    setUploadType(nextType);
    syncResourceReady(nextType, query);
    setMarkdownValue(audioUrl ? `${audioUrl}||${transcript}` : transcript);
    setAudioUploadOrRecord(false);
    setAIGenerated(true);
    setUploadVisible(true);
  };

  const passDesc = useMemo(
    () =>
      passageTypeFromRef(passage?.attributes?.reference) ===
      PassageTypeEnum.NOTE
        ? t.noteResource
        : t.passageResource,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passage]
  );

  const getSectionType = () => {
    const level = section.attributes?.level;
    if (level === SheetLevel.Book) return 'BOOK';
    if (level === SheetLevel.Movement) return 'MOVE';
    return undefined;
  };

  const sectDesc = useMemo(
    () =>
      getSectionType() === PassageTypeEnum.BOOK
        ? t.bookResource
        : getSectionType() === PassageTypeEnum.MOVEMENT
          ? t.movementResource
          : getOrganizedBy(true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section]
  );

  const listFilter = (r: IRow) =>
    r?.isResource &&
    (allResources || r.passageId === '' || r.passageId === passage.id);

  const [selectedRows, setSelectedRows] = useState<IRow[]>(
    rowData.filter(listFilter)
  );

  useEffect(() => {
    if (!busy && !remoteBusy) {
      setSelectedRows(rowData.filter(listFilter));
      setSortKey((sortKey) => sortKey + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData, allResources, busy, remoteBusy]);

  const onSortEnd = ({
    oldIndex,
    newIndex,
  }: {
    oldIndex: number;
    newIndex: number;
  }) => {
    if (!modifiable) return;
    if (oldIndex === newIndex) return;
    const indexes = Array<number>();
    rowData.forEach((r, i) => {
      if (listFilter(r)) indexes.push(i);
    });
    const newIndexes = arrayMove(indexes, oldIndex, newIndex) as number[];
    for (let i = 0; i < newIndexes.length; i += 1) {
      const secResRec = sectionResources.find(
        (r) => related(r, 'mediafile') === rowData[newIndexes[i]].id
      );
      if (secResRec && secResRec.attributes?.sequenceNum !== i) {
        UpdateSectionResource({
          ...secResRec,
          attributes: { ...secResRec?.attributes, sequenceNum: i },
        });
      }
    }
    // newIndexes is indexed by display (filtered) position, so track that
    // separately from the rowData position while rebuilding the list.
    let displayIndex = 0;
    const newRows = rowData.map((r) =>
      listFilter(r) ? rowData[newIndexes[displayIndex++]] : r
    );
    forceRefresh(newRows);
  };

  const afterUpload = async (planId: string, mediaRemoteIds?: string[]) => {
    let cnt = rowData.length;
    const projRes = new Array<MediaFileD>();
    const removeMedia = new Array<RecordOperation>();
    const tr = new RecordTransformBuilder();
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
      // Set when advancing to the configure step, which still offers Back to the
      // upload dialog — resetEdit must then preserve the category/description/
      // filename restore state instead of clearing it (closeProjResWiz clears it
      // once that step actually finishes).
      let preserveResourceForm = false;
      if (projRes.length === 1) {
        isAddingAudioResourceRef.current = true;
        if (sectionsPreselectedRef.current) {
          // Deferred flow: passages/sections were already chosen on
          // SelectSections (which stayed open during the upload). The upload
          // succeeded, so close it now and go to the configure step, or write
          // visual resources directly.
          const media = projRes[0] as MediaFileD;
          projMediaRef.current = media;
          sectionsPreselectedRef.current = false;
          stagedResourceFilesRef.current = undefined;
          setResourceImportList(undefined);
          setUploading(false);
          setProjResPassageVisible(false);
          if (isVisual(media)) {
            await writeVisualResource(projIdentRef.current);
            setVisual(false);
          } else {
            // The configure step plays the context's playerMediafile; load it here
            // since this path bypasses handleSelectProjectResource.
            setSelected(media.id, PlayInPlayer.yes);
            setProjResWizVisible(true);
            preserveResourceForm = true;
          }
        } else {
          setProjResSetup(projRes);
        }
      }
      resetEdit(preserveResourceForm);
    }
    if (removeMedia.length > 0) {
      await memory.update(removeMedia);
    }
    cancelled.current = false;
    // Deferred upload produced no media (the upload failed). SelectSections is
    // still open with the user's selection intact, so just re-enable its Upload
    // button (the error was already surfaced by the uploader) and keep the
    // staged file so they can retry without re-selecting. (A general resource is
    // a single configured source; adding several at once is unsupported and is
    // prevented in the UI, so only the single-media path is handled here.)
    if (sectionsPreselectedRef.current && projRes.length === 0) {
      sectionsPreselectedRef.current = false;
      setResourceImportList(undefined);
      setUploading(false);
    }
  };

  const resourceSourcePassages = useMemo(() => {
    const results: number[] = [];
    sectionResources.forEach((sr) => {
      const rec = findRecord(memory, 'mediafile', related(sr, 'mediafile')) as
        MediaFileD | undefined;
      if (rowData.find((r) => r.id === rec?.id)) {
        const passageId = rec?.attributes.resourcePassageId;
        if (passageId) results.push(passageId);
      }
    });
    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionResources, rowData]);

  useEffect(() => {
    getArtifactCategorys(ArtifactCategoryType.Resource).then(
      (cats) => (catRef.current = cats)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectShared = async (res: Resource[]) => {
    let cnt = rowData.length;
    for (const r of res) {
      const catRec = catRef.current.find(
        (c) => c.slug === r?.attributes?.categoryName
      );
      const newMediaRec = await AddMediaFileResource(r, catRec?.id || '');
      cnt += 1;
      await AddSectionResource(
        cnt,
        r?.attributes?.title || r?.attributes?.reference,
        newMediaRec,
        isPassageResource() ? passage.id : null
      );
    }
  };

  const handleSelectProjectResource = (m: MediaFileD) => {
    setSelected(m.id, PlayInPlayer.yes);
    projMediaRef.current = m;
    setVisual(isVisual(m));
    setProjectResourceVisible(false);
    setProjResPassageVisible(true);
  };

  // Deferred general-resource add: the Add Audio Resource dialog's Next hands
  // the prepared file here instead of uploading. We keep the file, open
  // SelectSections, and defer the real upload to that dialog's Upload button
  // (handleSelectProjectResourcePassage). No media exists yet, so there are no
  // existing assignments to pre-check.
  const handleStageAudioFiles = async (files: File[]) => {
    // we should only have one file if going through the general resource flow
    if (!files || files.length !== 1) return;
    // Commit a newly-typed artifact category now, while the dialog's metaData is
    // still mounted; the deferred upload runs after it unmounts. Null the ref so
    // the later upload's beforeUpload does not create a second category.
    pendingResourceSeqRef.current = 0;
    if (addCatCommitRef.current) {
      catIdRef.current = await addCatCommitRef.current();
      addCatCommitRef.current = null;
    }
    stagedResourceFilesRef.current = files;
    // Also seed the upload-tab restore state (normally set by handleResourceUploadFiles
    // via onFiles) so a recorded take — which bypasses that callback — is still
    // pre-selected if the user Backs out to the upload dialog and returns.
    setResourceUploadFiles(files);
    cancelled.current = false;
    isAddingAudioResourceRef.current = true;
    projMediaRef.current = undefined;
    // Fresh add: no prior selection to pre-check on SelectSections. (A Back from
    // the configure step repopulates projIdentRef, so only clear it here.)
    projIdentRef.current = [];
    // Staging only happens for the "Add Audio Resource" → General Resource flow,
    // which is always audio, so this is never a visual resource. (Visual general
    // resources are reached by selecting an existing project-resource media, not
    // through staging.) The visual-vs-wizard routing in afterUpload keys off the
    // uploaded media's own type, so this only sets the SelectSections label.
    setVisual(false);
    setUploadVisible(false);
    setProjResPassageVisible(true);
  };

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

  const handleTextChange = (text: string) => {
    textRef.current = text;
    const ct = mediaContentType(mediaRef.current);
    setAllowEditSave(
      canSaveResourceEdit({
        contentType: ct,
        description: descriptionRef.current,
        text,
        originalFile: mediaRef.current?.attributes?.originalFile,
        isUrl,
      })
    );
  };

  useEffect(() => {
    if (!projResPassageVisible && !projResWizVisible && projMediaRef.current)
      setProjResSetup(projResSetup.filter((m) => m !== projMediaRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projResPassageVisible, projResWizVisible]);

  // If SelectSections closes without starting the deferred upload (the user
  // discarded/closed it before clicking Upload), drop the staged file(s).
  // Otherwise a later SelectSections run — e.g. configuring an existing general
  // resource — would see stale files and wrongly upload them. When the upload
  // has started, sectionsPreselectedRef is true and afterUpload clears them.
  useEffect(() => {
    if (!projResPassageVisible && !sectionsPreselectedRef.current) {
      stagedResourceFilesRef.current = undefined;
    }
  }, [projResPassageVisible]);

  useEffect(() => {
    if (projResSetup.length) {
      handleSelectProjectResource(projResSetup[0] as MediaFileD);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projResSetup]);

  const handleSelectProjectResourcePassage = (
    items: RecordIdentity[],
    candidates: RecordIdentity[]
  ) => {
    projIdentRef.current = items;
    projCandidateRef.current = candidates;
    if (stagedResourceFilesRef.current) {
      // Deferred new-add flow: the file has not been uploaded yet. Upload it now
      // (headlessly, through the always-mounted Uploader's importList) while
      // SelectSections stays open with its button spinner. afterUpload advances
      // to the configure step on success, or re-enables the button on failure
      // so the user can retry without losing this selection.
      sectionsPreselectedRef.current = true;
      setUploading(true);
      setResourceImportList(stagedResourceFilesRef.current);
      return;
    }
    if (isVisual(projMediaRef.current)) {
      writeVisualResource(items).then(() => {
        setProjResPassageVisible(false);
      });
    } else {
      setProjResWizVisible(true);
      setProjResPassageVisible(false);
    }
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
    const ct = mediaContentType(mediaRef.current);
    if (editResource) {
      setAllowEditSave(
        canSaveResourceEdit({
          contentType: ct,
          description: desc,
          text: textRef.current ?? '',
          originalFile: mediaRef.current?.attributes?.originalFile,
          isUrl,
        })
      );
    } else {
      syncResourceReady(uploadType, desc);
    }
  };

  const handlePassRes = (newValue: ResourceTypeEnum) => {
    setResourceKind(newValue);
    if (newValue === ResourceTypeEnum.projectResource) {
      artifactState.id = projResourceType ?? null;
      setUploadType(UploadType.ProjectResource);
      syncResourceReady(UploadType.ProjectResource, descriptionRef.current);
    } else if (
      artifactState.id === projResourceType ||
      uploadType === UploadType.ProjectResource
    ) {
      artifactState.id = resourceType ?? null;
      setUploadType(UploadType.Resource);
      syncResourceReady(UploadType.Resource, descriptionRef.current);
    }
  };

  const handleEnded = () => {
    setPlayItem('');
    handleItemPlayEnd();
  };

  const handleLoaded = () => {
    if (playItem !== '' && !itemPlaying) {
      setTimeout(() => handleItemTogglePlay(), 1000);
    }
  };

  const [hasProjRes, setHasProjRes] = useState(false);
  const { isMobileWidth } = useMobile();

  useEffect(() => {
    getProjectResources().then((res) => setHasProjRes(res.length > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafiles]);

  const isScripture = useMemo(
    () => planType(plan)?.scripture,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]
  );

  return (
    <>
      <Stack sx={{ width: '100%', my: 2, pl: 2 }} direction="row" spacing={1}>
        <Grid
          container
          size={12}
          spacing={theme.layout.p}
          wrap="nowrap"
          sx={{
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            width: '100%',
            overflow: 'hidden',
          }}
        >
          {isScripture && (
            <Grid sx={{ flexShrink: 0 }}>
              <Button disableTypography onClick={() => handleFindVisible(true)}>
                <Badge badgeContent={`(${ts.ai})`}>{t.research}</Badge>
              </Button>
            </Grid>
          )}
          {hasPermission && (!offline || offlineOnly) && (
            <>
              <Grid sx={{ flexShrink: 0 }}>
                <AddResource action={handleAction} />
              </Grid>
              {hasProjRes && !isMobileWidth && (
                <Grid sx={{ flexShrink: 0 }}>
                  <Button onClick={() => setProjectResourceVisible(true)}>
                    {t.configure}
                  </Button>
                </Grid>
              )}
            </>
          )}
          {playItem !== '' && (
            <Grid
              sx={{
                width: '50%',
                minWidth: 0,
                flexShrink: 1,
                overflow: 'hidden',
              }}
            >
              <MediaContainer>
                <LimitedMediaPlayer
                  srcMediaId={playItem}
                  requestPlay={itemPlaying}
                  onEnded={handleEnded}
                  onLoaded={handleLoaded}
                  onTogglePlay={handleItemTogglePlay}
                  controls={playItem !== ''}
                  limits={{ start: mediaStart ?? 0, end: mediaEnd ?? 0 }}
                />
              </MediaContainer>
            </Grid>
          )}
          {otherResourcesAvailable && (
            <Grid sx={{ flexShrink: 0 }}>
              <PassageResourceButton
                value={allResources}
                label={t.allResources}
                cb={handleAllResources}
              />
            </Grid>
          )}
        </Grid>
      </Stack>
      <SortableHeader showDragHandle={modifiable} />
      <VertListDnd
        key={`sort-${sortKey}`}
        onDrop={onSortEnd}
        dragHandle
        isDragDisabled={!modifiable}
      >
        {selectedRows.map((value, index) => (
          <SortableItem
            key={`item-${index}`}
            value={value as any}
            contentType={mediaContentType(value.mediafile)}
            isPlaying={playItem === value.id && itemPlaying}
            onPlay={handlePlay}
            onView={handleDisplayId}
            onLink={handleLinkId}
            onMarkDown={handleMarkDownId}
            onDone={handleDone}
            onDelete={modifiable ? handleDelete : undefined}
            onEdit={modifiable ? handleEdit : undefined}
            showDragHandle={modifiable}
          />
        ))}
      </VertListDnd>
      <Uploader
        audioUploadOrRecord={audioUploadOrRecord}
        hideUploadCancel
        confirmOnClose
        isOpen={uploadVisible}
        onOpen={handleUploadVisible}
        showMessage={showMessage}
        multiple={true}
        finish={afterUpload}
        beforeUpload={async () => {
          pendingResourceSeqRef.current = 0;
          if (addCatCommitRef.current)
            catIdRef.current = await addCatCommitRef.current();
        }}
        cancelled={cancelled}
        cancelReset={resetEdit}
        artifactState={artifactState}
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
        // When returning here via the back button, display the previously selected files
        initialFiles={resourceUploadFiles}
        deferUpload={uploadType === UploadType.ProjectResource}
        onStageFiles={handleStageAudioFiles}
        validationMessage={resourceUploadValidationMessage}
        metaData={
          <ResourceData
            uploadType={uploadType}
            catAllowNew={true} //if they can upload they can add cat
            // Restores a category/description already entered before the user
            // stepped Back to change the file (both refs are blank on a fresh add).
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
      <BigDialog
        title={t.findResource.replace('{0}', passageRef(passage) || '')}
        description={<Typography>{t.findResourceDesc}</Typography>}
        isOpen={findOpen}
        onOpen={handleFindVisible}
        bp={BigDialogBp.sm}
      >
        <FindTabs
          onClose={() => handleFindVisible(false)}
          canAdd={hasPermission}
          onMarkdown={handleMarkdownValue}
        />
      </BigDialog>
      <BigDialog
        title={t.sharedResource.replace(
          '{0}',
          resourceKind === ResourceTypeEnum.sectionResource
            ? getOrganizedBy(true)
            : t.passageResource
        )}
        isOpen={sharedResourceVisible}
        onOpen={handleSharedResourceVisible}
        bp={BigDialogBp.md}
      >
        <SelectSharedResource
          sourcePassages={resourceSourcePassages}
          scope={resourceKind}
          onScope={setResourceKind}
          onSelect={handleSelectShared}
          onOpen={handleSharedResourceVisible}
        />
      </BigDialog>
      <BigDialog
        bp={BigDialogBp.lg}
        title={t.generalResources}
        isOpen={projectResourceVisible}
        onOpen={handleProjectResourceVisible}
      >
        <SelectProjectResource
          onSelect={(m) => {
            isAddingAudioResourceRef.current = false;
            handleSelectProjectResource(m);
          }}
          onOpen={handleProjectResourceVisible}
        />
      </BigDialog>
      <BigDialog
        title={
          isAddingAudioResourceRef.current
            ? t.addAudioResource
            : t.editAudioResource
        }
        description={
          <Typography sx={{ color: 'text.secondary' }}>
            {t.selectPassagesSub.replace('{0}', getOrganizedBy(false))}
          </Typography>
        }
        isOpen={projResPassageVisible}
        onOpen={handleProjResPassageVisible}
        disableBackdropClose
      >
        {projResPassageVisible ? (
          <SelectSections
            initialItems={
              // Returning here via the configure step's Back re-checks the prior
              // selection (the media has no saved assignments yet). Other entry
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
            // after a Back from configure the media exists, so it just advances.
            uploadsOnNext={
              isAddingAudioResourceRef.current && !projMediaRef.current
            }
            uploading={uploading}
            onSelect={handleSelectProjectResourcePassage}
            onBack={
              isAddingAudioResourceRef.current ? handlePassageBack : undefined
            }
          />
        ) : (
          <></>
        )}
      </BigDialog>
      <BigDialog
        title={
          isAddingAudioResourceRef.current
            ? t.addAudioResource
            : t.editAudioResource
        }
        isOpen={projResWizVisible}
        onOpen={handleProjResWizVisible}
        bp={BigDialogBp.md}
        disableBackdropClose
        // Flex column so ProjectResourceConfigure can fill the height and pin
        // its footer buttons to the dialog bottom.
        dialogContentSx={{ display: 'flex', flexDirection: 'column' }}
      >
        {projResWizVisible ? (
          <ProjectResourceConfigure
            // Exceeds the md dialog's inner width so the player's maxWidth:100%
            // clamps it to fill, extending the waveform to the dialog's edge.
            width={1000}
            media={projMediaRef.current}
            items={projIdentRef.current}
            candidateItems={projCandidateRef.current}
            resourceTypeId={resourceType}
            onOpen={closeProjResWiz}
            onBack={
              isAddingAudioResourceRef.current ? handleWizBack : undefined
            }
          />
        ) : (
          <></>
        )}
      </BigDialog>
      <BigDialog
        title={editAudio ? t.editAudioResource : t.editResource}
        isOpen={Boolean(editResource)}
        onOpen={handleEditResourceVisible}
        onSave={allowEditSave ? handleEditSave : undefined}
        onCancel={handleEditCancel}
        bp={BigDialogBp.sm}
        showBottomCancelButton={false}
        disableBackdropClose
      >
        <ResourceData
          media={mediaRef.current}
          uploadType={uploadType}
          catAllowNew={true}
          initCategory={catIdRef.current || ''}
          onCategoryChange={handleCategory}
          catCommitRef={editCatCommitRef}
          initDescription={descriptionRef.current}
          onDescriptionChange={handleDescription}
          catRequired={false}
          resourceKind={resourceKind}
          onPassResChange={handlePassRes}
          allowProject={false}
          onTextChange={handleTextChange}
          sectDesc={sectDesc}
          passDesc={passDesc}
        />
      </BigDialog>
      {confirm && (
        <Confirm
          text={t.deleteConfirm}
          yesResponse={handleDeleteConfirmed}
          noResponse={handleDeleteRefused}
        />
      )}
      {dialogPendingCloseConfirmation && (
        <Confirm
          title={t.confirmCloseTitle}
          text={t.confirmClose}
          no={t.keepOpen}
          primaryButton="no"
          yes={t.discardAndClose}
          noResponse={() => setDialogPendingCloseConfirmation(null)}
          yesResponse={
            dialogPendingCloseConfirmation === 'passage'
              ? handlePassageDiscard
              : dialogPendingCloseConfirmation === 'wiz'
                ? handleWizDiscard
                : handleEditDiscard
          }
        />
      )}
      {displayId && (
        <MediaDisplay srcMediaId={displayId} finish={handleFinish} />
      )}
      {markDown && (
        <BigDialog
          title={t.textResource}
          isOpen={Boolean(markDown)}
          onOpen={() => setMarkDoan('')}
          bp={BigDialogBp.sm}
        >
          <MarkDownView value={markDown} />
        </BigDialog>
      )}
      {audioScriptureVisible && (
        <BigDialog
          title={t.audioScripture}
          isOpen={Boolean(audioScriptureVisible)}
          onOpen={() => setAudioScriptureVisible(false)}
          bp={BigDialogBp.sm}
          setCloseRequested={setBiblebrainClose}
        >
          <FindBibleBrain
            handleLink={handleLink}
            onClose={() => setAudioScriptureVisible(false)}
            closeRequested={biblebrainClose}
          />
        </BigDialog>
      )}
      <LaunchLink url={link} reset={() => setLink('')} />
    </>
  );
}

export default PassageDetailArtifacts;
