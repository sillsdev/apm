import { useState, useMemo, useRef, useEffect } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import {
  IPassageDetailArtifactsStrings,
  MediaFileD,
  SectionResourceD,
  ArtifactType,
  Resource,
  SheetLevel,
  ISharedStrings,
} from '../../../model';
import { arrayMoveImmutable as arrayMove } from 'array-move';
import { PlayInPlayer } from '../../../context/PlayInPlayer';
import AddResource from './AddResource';
import { IRow } from '../../../context/PassageDetailContext';
import { Button, GrowingSpacer } from '../../../control';
import { AudioResourceCard } from './mobile components/AudioResourceCard';
import { TextResourceCard } from './mobile components/TextResourceCard';
import {
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
  useRole,
  ArtifactTypeSlug,
  mediaFileName,
} from '../../../crud';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import MediaDisplay from '../../MediaDisplay';
import SelectSharedResource from './SelectSharedResource';
import ResourceData from './ResourceData';
import { MarkDownType, UriLinkType } from '../../MediaUpload';
import { canSaveResourceEdit } from './resourceArtifactName';
import { Box, Stack, Typography, MenuItem, MenuList } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { ReplaceRelatedRecord } from '../../../model/baseModel';
import Confirm from '../../AlertDialog';
import { getSegments, NamedRegions, isUrl, useMobile } from '../../../utils';
import { useOrbitData } from '../../../hoc/useOrbitData';
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
import FindTabs from './FindTabs';
import {
  countProjectResourceCopies,
  removeProjectResource,
} from './projectResourceAssignments';
import GeneralResourceDeleteDialog from './GeneralResourceDeleteDialog';
import { storedCompareKey } from '../../../utils/storedCompareKey';
import { mediaContentType } from '../../../utils/contentType';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { isLinkedNote } from '../../../crud/isLinkedNote';
import {
  generalResourceMedia,
  projectResourceTypeIds,
} from './generalResourceMedia';
import FindBibleBrain from './FindBibleBrain';
import { useHandleLink } from './addLinkKind';
import { usePassageRef } from './usePassageRef';
import { CompactMarkDownView } from '../../../control/MarkDownView';
import { UploadType } from '../../UploadType';
import { ResourceTypeEnum } from './ResourceTypeEnum';
import { AddResourceAction } from './AddResourceAction';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import IconMenu from '../../../control/IconMenu';
import AddResourceWizard, { WizardLaunch } from './AddResourceWizard';

export function PassageDetailArtifactsMobile() {
  const sectionResources = useOrbitData<SectionResourceD[]>('sectionresource');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const artifactTypes = useOrbitData<ArtifactType[]>('artifacttype');
  const [memory] = useGlobal('memory');
  const [busy, setBusy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [remoteBusy] = useGlobal('remoteBusy'); //verified this is not used in a function 2/18/25
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
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
    sharedResource,
  } = usePassageDetailContext();
  const { getOrganizedBy } = useOrganizedBy();
  const { AddSectionResource } = useSecResCreate(section);
  const AddSectionResourceUser = useSecResUserCreate();
  const ReadSectionResourceUser = useSecResUserRead();
  const RemoveSectionResourceUser = useSecResUserDelete();
  const AddMediaFileResource = useMediaResCreate(passage, currentstep);
  const UpdateSectionResource = useSecResUpdate();
  const DeleteSectionResource = useSecResDelete();
  const { getArtifactCategorys } = useArtifactCategory();
  const catRef = useRef<IArtifactCategory[]>([]);
  const [findOpen, setFindOpen] = useState(false);
  const [sortKey, setSortKey] = useState(0);
  const [displayId, setDisplayId] = useState('');
  const [link, setLink] = useState<string>();
  const [markDown, setMarkDoan] = useState('');
  const [markDownTitle, setMarkDownTitle] = useState('');
  const [audioScriptureVisible, setAudioScriptureVisible] = useState(false);
  const [sharedResourceVisible, setSharedResourceVisible] = useState(false);
  const [editResource, setEditResource] = useState<
    SectionResourceD | undefined
  >();
  const [allowEditSave, setAllowEditSave] = useState(false);
  // Pending open request handed to the add-resource wizard (null = closed).
  const [wizardLaunch, setWizardLaunch] = useState<WizardLaunch | null>(null);
  const [uploadType, setUploadType] = useState<UploadType>(UploadType.Resource);
  const [editAudio, setEditAudio] = useState<boolean>(false);
  const mediaRef = useRef<MediaFileD | undefined>(undefined);
  const textRef = useRef<string | undefined>(undefined);
  const catIdRef = useRef<string | undefined>(undefined);
  // commit() handle for the edit dialog's SelectArtifactCategory. Called at save
  // to create a new category the user typed (deferred from blur).
  const editCatCommitRef = useRef<(() => Promise<string>) | null>(null);
  const descriptionRef = useRef<string>('');

  const [resourceKind, setResourceKindx] = useState(
    ResourceTypeEnum.sectionResource
  );
  const resourceKindRef = useRef(resourceKind);
  const setResourceKind = (kind: ResourceTypeEnum) => {
    resourceKindRef.current = kind;
    setResourceKindx(kind);
  };

  const [allResources, setAllResources] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [mediaStart, setMediaStart] = useState<number | undefined>();
  const [mediaEnd, setMediaEnd] = useState<number | undefined>();
  const { removeKey } = storedCompareKey(passage, section);
  const [plan] = useGlobal('plan'); //will be constant here
  const planType = usePlanType();
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
  const { userIsAdmin } = useRole();
  // Admins see badges for resources that are linked (shared) or general; other users don't.
  const typeBadge = (row: IRow) =>
    !userIsAdmin
      ? undefined
      : // The badge stays short: "General" where the Type column says
        // "General Resource".
        row.isGeneralResource
        ? t.general
        : row.artifactTypeSlug === ArtifactTypeSlug.SharedResource
          ? row.artifactType
          : undefined;
  const [biblebrainClose, setBiblebrainClose] = useState(false);
  // Confirm-before-discard for the simple edit dialog.
  const [editCloseConfirmation, setEditCloseConfirmation] = useState(false);
  const handleLink = useHandleLink({ passage, setLink });
  const { passageRef } = usePassageRef();
  const { isMobileWidth } = useMobile();
  const [expandedArtifactNameId, setExpandedArtifactNameId] = useState<
    string | null
  >(null);

  const otherResourcesAvailable = useMemo(
    () => rowData.some((r) => r.passageId && r.passageId !== passage.id),
    [passage, rowData]
  );

  const isPassageResource = () =>
    resourceKindRef.current === ResourceTypeEnum.passageResource;

  // Both projectresource type records (offline + remote); used to resolve
  // general resources for the type label, Edit, and Delete (see
  // [[generalResourceMedia]]).
  const projResourceTypeIds = useMemo(
    () => projectResourceTypeIds(artifactTypes),
    [artifactTypes]
  );

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
    setMarkDownTitle(
      rowData.find((r) => r.id === id)?.artifactName || t.textResource
    );
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
  // When the row being deleted is a copy of a general resource, the user
  // chooses between deleting just this copy and the whole general resource.
  const confirmGeneralSource = useMemo(
    () =>
      confirm
        ? generalResourceMedia(
            mediafiles.find((m) => m.id === confirm),
            mediafiles,
            projResourceTypeIds,
            // Rows never show the general resource itself, so a row being
            // deleted is only ever a derived copy of one.
            { includeSelf: false }
          )
        : undefined,
    [confirm, mediafiles, projResourceTypeIds]
  );
  const confirmGeneralCopies = countProjectResourceCopies(
    confirmGeneralSource,
    mediafiles
  );
  const handleDeleteGeneralResource = async () => {
    const sourceMedia = confirmGeneralSource;
    removeKey(confirm);
    setConfirm('');
    if (!sourceMedia) return;
    setBusy(true);
    try {
      await removeProjectResource({
        memory,
        sourceMedia,
        mediafiles,
        sectionResources,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleFindVisible = (v: boolean) => {
    setFindOpen(v);
  };

  const handleSharedResourceVisible = (v: boolean) => {
    setSharedResourceVisible(v);
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
    // Resolve to the root general resource; the same resolution decides the
    // "General" type label and mobile badge (see [[generalResourceMedia]]).
    const projectMedia = generalResourceMedia(
      mf,
      mediafiles,
      projResourceTypeIds
    );
    // General (project) resources are reconfigured through the wizard, not the
    // simple edit dialog (mockup: "use Edit to also configure the General Resource").
    if (projectMedia) {
      setResourceKind(ResourceTypeEnum.projectResource);
      setWizardLaunch({ kind: 'editGeneral', media: projectMedia });
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
  const resetEdit = () => {
    setEditResource(undefined);
    catIdRef.current = undefined;
    descriptionRef.current = '';
    setResourceKind(ResourceTypeEnum.sectionResource);
    setEditAudio(false);
  };
  const handleEditResourceVisible = (v: boolean) => {
    if (!v) {
      setEditCloseConfirmation(true);
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
    setEditCloseConfirmation(true);
  };
  const handleEditDiscard = () => {
    setEditCloseConfirmation(false);
    resetEdit();
  };

  const handleAction = (what: AddResourceAction) => {
    if (what === AddResourceAction.Scripture) {
      setAudioScriptureVisible(true);
    } else if (what === AddResourceAction.Shared) {
      setResourceKind(ResourceTypeEnum.sectionResource);
      setSharedResourceVisible(true);
    } else if (
      // Audio / Pdf / Text / Link all enter the upload-based wizard. Listing
      // them explicitly narrows `what` to AddUploadAction (no cast needed).
      what === AddResourceAction.Audio ||
      what === AddResourceAction.Pdf ||
      what === AddResourceAction.Text ||
      what === AddResourceAction.Link
    ) {
      setWizardLaunch({ kind: 'add', action: what });
    }
  };

  // Research (FindTabs) produced markdown or a Faithbridge link; seed the wizard
  // upload step with it.
  const handleMarkdownValue = (
    query: string,
    audioUrl: string,
    transcript: string
  ) => {
    setWizardLaunch({ kind: 'markdown', query, audioUrl, transcript });
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

  const handleCategory = (categoryId: string) => {
    catIdRef.current = categoryId;
  };

  const handleDescription = (desc: string) => {
    descriptionRef.current = desc;
    const ct = mediaContentType(mediaRef.current);
    setAllowEditSave(
      canSaveResourceEdit({
        contentType: ct,
        description: desc,
        text: textRef.current ?? '',
        originalFile: mediaRef.current?.attributes?.originalFile,
        isUrl,
      })
    );
  };

  // The edit dialog never offers the General scope (allowProject=false), so the
  // toggle only moves between section and passage.
  const handlePassRes = (newValue: ResourceTypeEnum) => {
    setResourceKind(newValue);
  };

  const handleEnded = () => {
    setPlayItem('');
    handleItemPlayEnd();
  };

  const isScripture = useMemo(
    () => planType(plan)?.scripture,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]
  );

  return (
    <Box sx={{ maxWidth: '800px', margin: '0 auto' }}>
      <Stack sx={{ width: '100%' }} direction="row" spacing={1}>
        {isScripture && (
          <Box>
            <Button onClick={() => handleFindVisible(true)}>
              {t.research}
            </Button>
          </Box>
        )}
        {hasPermission && (!offline || offlineOnly) && !isMobileWidth && (
          <AddResource action={handleAction} />
        )}
        <GrowingSpacer />
        {otherResourcesAvailable && (
          <IconMenu icon={<SettingsOutlinedIcon />}>
            <MenuList dense>
              <MenuItem onClick={handleAllResources}>{t.allResources}</MenuItem>
            </MenuList>
          </IconMenu>
        )}
      </Stack>
      <Box sx={{ width: '100%' }}>
        <VertListDnd
          key={`sort-${sortKey}`}
          onDrop={onSortEnd}
          dragHandle
          dragHandleRegion="top-half"
          lockHorizontal
          itemSpacing={0.25}
          listPaddingX={0}
          itemPaddingX={0}
          isDragDisabled={!modifiable}
        >
          {selectedRows.map((value) => (
            <Box key={`item-${value.id}`} sx={{ width: '100%' }}>
              {/^audio/.test(mediaContentType(value.mediafile)) ? (
                <AudioResourceCard
                  row={value}
                  subtitle={value.artifactCategory || undefined}
                  badge={typeBadge(value)}
                  isPlaying={playItem === value.id && itemPlaying}
                  onPlay={handlePlay}
                  expandedId={expandedArtifactNameId}
                  setExpandedId={setExpandedArtifactNameId}
                  onDone={handleDone}
                  onEdit={modifiable ? handleEdit : undefined}
                  onDelete={modifiable ? handleDelete : undefined}
                  onEnded={handleEnded}
                  limits={{ start: mediaStart ?? 0, end: mediaEnd ?? 0 }}
                />
              ) : (
                <TextResourceCard
                  row={value}
                  subtitle={value.artifactCategory || undefined}
                  badge={typeBadge(value)}
                  expandedId={expandedArtifactNameId}
                  setExpandedId={setExpandedArtifactNameId}
                  onView={
                    mediaContentType(value.mediafile) === UriLinkType
                      ? handleLinkId
                      : mediaContentType(value.mediafile) === MarkDownType
                        ? handleMarkDownId
                        : handleDisplayId
                  }
                  onDone={handleDone}
                  onEdit={modifiable ? handleEdit : undefined}
                  onDelete={modifiable ? handleDelete : undefined}
                />
              )}
            </Box>
          ))}
        </VertListDnd>
      </Box>
      <AddResourceWizard
        launch={wizardLaunch}
        onLaunchHandled={() => setWizardLaunch(null)}
        configureWidth={800}
      />
      <BigDialog
        title={`Research - ${passageRef(passage) || ''}`.trim()}
        titleVariant="h6"
        description={
          <Typography sx={{ color: 'text.secondary' }}>
            {t.findResourceDesc}
          </Typography>
        }
        isOpen={findOpen}
        onOpen={handleFindVisible}
        bp={BigDialogBp.mobile}
        mobilePaperWidth="min(356px, calc(100vw - 4px))"
        dialogContentSx={{
          px: '3px',
          pb: '4px',
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'hidden',
        }}
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
        bp={BigDialogBp.mobile}
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
        title={editAudio ? t.editAudioResource : t.editResource}
        isOpen={Boolean(editResource)}
        onOpen={handleEditResourceVisible}
        onSave={allowEditSave ? handleEditSave : undefined}
        onCancel={handleEditCancel}
        bp={BigDialogBp.mobile}
        showBottomCancelButton={false}
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
          wrapPreviewOverflow
          sectDesc={sectDesc}
          passDesc={passDesc}
        />
      </BigDialog>
      {confirm &&
        (confirmGeneralSource && confirmGeneralCopies > 1 ? (
          <GeneralResourceDeleteDialog
            fileName={mediaFileName(confirmGeneralSource)}
            count={confirmGeneralCopies}
            onCancel={handleDeleteRefused}
            onDeleteAll={handleDeleteGeneralResource}
            onDeleteOne={handleDeleteConfirmed}
          />
        ) : (
          <Confirm
            text={t.deleteConfirm}
            // Deleting the last copy of a general resource takes its source
            // with it; nothing else in the UI can reach an unassigned source.
            yesResponse={
              confirmGeneralSource
                ? handleDeleteGeneralResource
                : handleDeleteConfirmed
            }
            noResponse={handleDeleteRefused}
          />
        ))}
      {editCloseConfirmation && (
        <Confirm
          title={t.confirmCloseTitle}
          text={t.confirmClose}
          no={t.keepOpen}
          primaryButton="no"
          yes={t.discardAndClose}
          noResponse={() => setEditCloseConfirmation(false)}
          yesResponse={handleEditDiscard}
        />
      )}
      {displayId && (
        <MediaDisplay srcMediaId={displayId} finish={handleFinish} />
      )}
      {markDown && (
        <BigDialog
          title={markDownTitle || t.textResource}
          titleStartAdornment={<VisibilityIcon fontSize="medium" />}
          titleVariant="h6"
          showTopCloseButton={false}
          showBottomCloseButton
          bottomCloseLabel={ts.close}
          paperOutlineColor="black"
          mobileThickScrollbar
          mobileNoHorizontalScroll
          isOpen={Boolean(markDown)}
          onOpen={() => {
            setMarkDoan('');
            setMarkDownTitle('');
          }}
          bp={BigDialogBp.mobile}
        >
          <CompactMarkDownView value={markDown} wrapOverflow />
        </BigDialog>
      )}
      {audioScriptureVisible && (
        <BigDialog
          title={t.audioScripture}
          isOpen={Boolean(audioScriptureVisible)}
          onOpen={() => setAudioScriptureVisible(false)}
          bp={BigDialogBp.mobile}
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
    </Box>
  );
}

export default PassageDetailArtifactsMobile;
