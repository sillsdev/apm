import ResourceUploadStep from './ResourceUploadStep';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import SelectSections from './SelectSections';
import ResourceData from './ResourceData';
import { Box, Typography } from '@mui/material';
import ProjectResourceConfigure from './ProjectResourceConfigure';
import Confirm from '../../AlertDialog';
import { safeFileBasename } from '../../../utils';
import { UploadType } from '../../UploadType';
import {
  useAddResourceWizard,
  WizardStep,
  type WizardLaunch,
} from './useAddResourceWizard';

interface IProps {
  /** Which action opened the wizard; read once at mount to seed state. */
  launchSource: WizardLaunch;
  /** Asked to close (cancel, finish, or discard). The parent stops rendering
   *  the wizard, which unmounts it; the next open mounts it fresh. */
  onClose: () => void;
  /** Width passed to ProjectResourceConfigure's player (desktop 1000, mobile 800). */
  configureWidth?: number;
}

/**
 * The upload-based resource flow: step 1 (Uploader) is shared by every
 * add/research path; only the General (project) resource path continues to
 * step 2 (SelectSections) and step 3 (ProjectResourceConfigure). Extracted from
 * PassageDetailArtifacts so the step state lives in one place and the step
 * components keep their own state across Back/Next. All wizard state and
 * handlers live in useAddResourceWizard; this component is the view.
 */
export function AddResourceWizard({
  launchSource,
  onClose,
  configureWidth = 1000,
}: IProps) {
  const w = useAddResourceWizard({ launchSource, onClose });

  return (
    <>
      <BigDialog
        title={w.wizardTitle}
        description={
          w.step === WizardStep.SelectSections ? (
            <Typography sx={{ color: 'text.secondary' }}>
              {w.isAddingAudioResource
                ? w.t.selectPassagesSub.replace('{0}', w.getOrganizedBy(false))
                : w.t.editingFile.replace(
                    '{0}',
                    safeFileBasename(w.projMedia?.attributes?.originalFile)
                  )}
            </Typography>
          ) : undefined
        }
        // The parent renders the wizard only while open, so it is always open
        // whenever mounted; closing is driven by onClose, not this flag.
        isOpen
        onOpen={w.handleWizardClose}
        bp={BigDialogBp.md}
        disableBackdropClose
        // Flex column so the step content fills the height and footers pin to the
        // dialog bottom.
        dialogContentSx={{ display: 'flex', flexDirection: 'column' }}
      >
        <>
          {/* Step 1: the record/upload UI, embedded (no dialog of its own) so
                it shows/hides as a step and stays mounted across the flow — a
                recorded take survives Next→Back (see PassageRecordPanel).
                editGeneralResource enters at SelectSections and can never reach
                this step (no Back out of SelectSections — see the reachability
                table above), so skip mounting its heavy record/upload subtree. */}
          {launchSource.kind !== 'editGeneralResource' && (
            <Box
              sx={{
                display: w.step === WizardStep.Upload ? 'flex' : 'none',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: 0,
              }}
            >
              <ResourceUploadStep
                // A recording started this session — latch it on and never off,
                // so the close confirm survives Next→Back and step changes.
                onStartRecording={() => w.setRecordingStarted(true)}
                isAudioMode={w.isAddingAudioResource}
                active={w.step === WizardStep.Upload}
                multiple={true}
                finish={w.afterUpload}
                beforeUpload={w.handleBeforeUpload}
                cancelled={w.cancelled}
                cancelReset={onClose}
                artifactState={w.artifactState.current}
                uploadType={w.uploadType}
                ready={() => w.resourceReady}
                performedBy={w.performedBy}
                onSpeakerChange={(value) => w.setPerformedBy(value)}
                inValue={w.markdownValue}
                eafUrl={w.eafUrl}
                defaultFilename={w.filename}
                pendingRestore={w.resourcePendingRestore}
                onFiles={w.handleResourceUploadFiles}
                deferred={w.uploadType === UploadType.ProjectResource}
                onNext={w.handleUploadStepNext}
                submitRef={w.submitRef}
                validationMessage={w.resourceUploadValidationMessage}
                metaData={
                  <ResourceData
                    uploadType={w.uploadType}
                    catAllowNew={true} //if they can upload they can add cat
                    initCategory={w.initCategory}
                    onCategoryChange={w.handleCategory}
                    catCommitRef={w.addCategorySaveRef}
                    initDescription={w.initDescription}
                    onDescriptionChange={w.handleDescription}
                    catRequired={false}
                    resourceKind={w.resourceKind}
                    onPassResChange={w.handlePassRes}
                    allowGeneralResourceOption={w.isAddingAudioResource}
                    sectDesc={w.sectDesc}
                    passDesc={w.passDesc}
                  />
                }
              />
            </Box>
          )}
          {/* Step 2: SelectSections stays mounted while the dialog is open
                (CSS-hidden on the configure step) so its selection survives Back
                from configure with no re-seeding. */}
          <Box
            sx={{
              display: w.step === WizardStep.SelectSections ? 'flex' : 'none',
              flexDirection: 'column',
              flex: '1 1 auto',
              minHeight: 0,
            }}
          >
            <SelectSections
              initialItems={w.getInitialItems()}
              // The button uploads only when a media has not been created yet;
              // after a Back from configure the media exists, so it advances.
              uploadsOnNext={w.isAddingAudioResource && !w.projMedia}
              uploading={w.uploading}
              onSelect={w.handleSectionsSelected}
              onBack={
                w.isAddingAudioResource ? w.handleSelectSectionsBack : undefined
              }
            />
          </Box>
          {/* Configure mounts only on its step: the wavesurfer player is
                expensive and its unmount clears the unsaved-changes flag. */}
          {w.step === WizardStep.Configure && (
            <ProjectResourceConfigure
              // Exceeds the md dialog's inner width so the player's
              // maxWidth:100% clamps it to fill, extending the waveform to the
              // dialog's edge.
              width={configureWidth}
              media={w.projMedia}
              items={w.projIdentity}
              candidateItems={w.projCandidate}
              resourceTypeId={w.resourceType}
              onOpen={onClose}
              onBack={
                w.isAddingAudioResource ? w.handleConfigureBack : undefined
              }
            />
          )}
        </>
      </BigDialog>
      {w.pendingCloseConfirmation && (
        <Confirm
          title={w.t.confirmCloseTitle}
          text={w.t.confirmClose}
          no={w.t.keepOpen}
          primaryButton="no"
          yes={w.t.discardAndClose}
          noResponse={() => w.setPendingCloseConfirmation(false)}
          yesResponse={() => {
            w.setPendingCloseConfirmation(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

export default AddResourceWizard;
