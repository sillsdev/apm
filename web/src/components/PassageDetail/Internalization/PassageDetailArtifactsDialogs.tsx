import { ReactNode } from 'react';
import { Typography } from '@mui/material';
import Uploader from '../../Uploader';
import { AIGenerated } from '.';
import { mediaFileName } from '../../../crud';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import MediaDisplay from '../../MediaDisplay';
import SelectSharedResource from './SelectSharedResource';
import SelectSections from './SelectSections';
import ResourceData from './ResourceData';
import ProjectResourceConfigure from './ProjectResourceConfigure';
import Confirm from '../../AlertDialog';
import { safeFileBasename } from '../../../utils';
import { LaunchLink } from '../../../control/LaunchLink';
import { getProjectResourceAssignments } from './projectResourceAssignments';
import GeneralResourceDeleteDialog from './GeneralResourceDeleteDialog';
import FindTabs from './FindTabs';
import FindBibleBrain from './FindBibleBrain';
import { UploadType } from '../../UploadType';
import { ResourceTypeEnum } from './ResourceTypeEnum';
import { PassageDetailArtifactsState } from './usePassageDetailArtifacts';

interface PassageDetailArtifactsDialogsProps {
  state: PassageDetailArtifactsState;
  variant: 'desktop' | 'mobile';
  /** The text-resource viewer, which differs too much between variants to share. */
  markDownDialog: ReactNode;
}

/** Uploader and dialogs shared by the desktop and mobile resource lists. */
export function PassageDetailArtifactsDialogs({
  state,
  variant,
  markDownDialog,
}: Readonly<PassageDetailArtifactsDialogsProps>) {
  const {
    t,
    passage,
    hasPermission,
    mediafiles,
    sectionResources,
    resourceType,
    uploadVisible,
    handleUploadVisible,
    showMessage,
    afterUpload,
    pendingResourceSeqRef,
    addCatCommitRef,
    editCatCommitRef,
    catIdRef,
    descriptionRef,
    cancelled,
    resetEdit,
    artifactState,
    uploadType,
    resourceReady,
    handleNonAudio,
    audioUploadOrRecord,
    performedBy,
    setPerformedBy,
    markdownValue,
    aiGenerated,
    filename,
    resourcePendingRestore,
    resourceImportList,
    handleResourceUploadFiles,
    resourceUploadFiles,
    handleStageAudioFiles,
    resourceUploadValidationMessage,
    handleCategory,
    handleDescription,
    resourceKind,
    setResourceKind,
    handlePassRes,
    allowProject,
    sectDesc,
    passDesc,
    findOpen,
    handleFindVisible,
    passageRef,
    handleMarkdownValue,
    sharedResourceVisible,
    handleSharedResourceVisible,
    getOrganizedBy,
    resourceSourcePassages,
    handleSelectShared,
    isAddingAudioResourceRef,
    projMediaRef,
    projIdentRef,
    projCandidateRef,
    projResPassageVisible,
    handleProjResPassageVisible,
    visual,
    uploading,
    handleSelectProjectResourcePassage,
    handlePassageBack,
    projResWizVisible,
    handleProjResWizVisible,
    closeProjResWiz,
    handleWizBack,
    editAudio,
    editResource,
    handleEditResourceVisible,
    allowEditSave,
    handleEditSave,
    handleEditCancel,
    mediaRef,
    handleTextChange,
    confirm,
    confirmGeneralSource,
    confirmGeneralCopies,
    handleDeleteRefused,
    handleDeleteGeneralResource,
    handleDeleteConfirmed,
    dialogPendingCloseConfirmation,
    setDialogPendingCloseConfirmation,
    handlePassageDiscard,
    handleWizDiscard,
    handleEditDiscard,
    displayId,
    handleFinish,
    audioScriptureVisible,
    setAudioScriptureVisible,
    biblebrainClose,
    setBiblebrainClose,
    handleLink,
    link,
    setLink,
  } = state;
  const mobile = variant === 'mobile';

  let projResWizTitle = t.editGeneralResource;
  if (mobile) projResWizTitle = t.projectResourceConfigure;
  else if (isAddingAudioResourceRef.current)
    projResWizTitle = t.addAudioResource;

  let handleCloseDiscard = handleEditDiscard;
  if (dialogPendingCloseConfirmation === 'passage')
    handleCloseDiscard = handlePassageDiscard;
  else if (dialogPendingCloseConfirmation === 'wiz')
    handleCloseDiscard = handleWizDiscard;

  return (
    <>
      <Uploader
        audioUploadOrRecord={audioUploadOrRecord}
        hideUploadCancel
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
      {mobile ? (
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
      ) : (
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
      )}
      <BigDialog
        title={t.sharedResource.replace(
          '{0}',
          resourceKind === ResourceTypeEnum.sectionResource
            ? getOrganizedBy(true)
            : t.passageResource
        )}
        isOpen={sharedResourceVisible}
        onOpen={handleSharedResourceVisible}
        bp={mobile ? BigDialogBp.mobile : BigDialogBp.md}
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
        title={
          isAddingAudioResourceRef.current
            ? t.addAudioResource
            : t.editGeneralResource
        }
        description={
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
        title={projResWizTitle}
        isOpen={projResWizVisible}
        onOpen={handleProjResWizVisible}
        bp={mobile ? BigDialogBp.mobile : BigDialogBp.md}
        disableBackdropClose={!mobile}
        // Flex column so ProjectResourceConfigure can fill the height and pin
        // its footer buttons to the dialog bottom.
        dialogContentSx={
          mobile ? undefined : { display: 'flex', flexDirection: 'column' }
        }
      >
        {projResWizVisible ? (
          <ProjectResourceConfigure
            // Desktop: exceeds the md dialog's inner width so the player's
            // maxWidth:100% clamps it to fill, extending the waveform to the
            // dialog's edge.
            width={mobile ? 800 : 1000}
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
        bp={mobile ? BigDialogBp.mobile : BigDialogBp.sm}
        showBottomCancelButton={false}
        disableBackdropClose={!mobile}
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
          wrapPreviewOverflow={mobile || undefined}
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
      {dialogPendingCloseConfirmation && (
        <Confirm
          title={t.confirmCloseTitle}
          text={t.confirmClose}
          no={t.keepOpen}
          primaryButton="no"
          yes={t.discardAndClose}
          noResponse={() => setDialogPendingCloseConfirmation(null)}
          yesResponse={handleCloseDiscard}
        />
      )}
      {displayId && (
        <MediaDisplay srcMediaId={displayId} finish={handleFinish} />
      )}
      {markDownDialog}
      {audioScriptureVisible && (
        <BigDialog
          title={t.audioScripture}
          isOpen={Boolean(audioScriptureVisible)}
          onOpen={() => setAudioScriptureVisible(false)}
          bp={mobile ? BigDialogBp.mobile : BigDialogBp.sm}
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

export default PassageDetailArtifactsDialogs;
