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
  launchSource: WizardLaunch;
  onClose: () => void;
  configureWidth?: number;
}

/**
 * The upload-based resource flow: step 1 (ResourceUploadStep) is shared by every
 * add/research path; only the General (project) resource path continues to
 * step 2 (SelectSections) and step 3 (ProjectResourceConfigure). The step
 * components keep their own state across Back/Next.
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
        isOpen
        onOpen={w.handleWizardClose}
        bp={BigDialogBp.md}
        disableBackdropClose
        // Flex column so the step content fills the height and footers pin to the
        // dialog bottom.
        dialogContentSx={{ display: 'flex', flexDirection: 'column' }}
      >
        <>
          {/* Step 1: stays mounted across the flow (gets css-hidden on other steps) so a
                recorded take survives Next→Back (see PassageRecordPanel).*/}
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
                onStartRecording={() => w.setRecordingStarted(true)}
                isAudioMode={w.isAddingAudioResource}
                active={w.step === WizardStep.Upload}
                finish={w.afterUpload}
                beforeUpload={w.handleBeforeUpload}
                cancelled={w.cancelled}
                artifactState={w.artifactState.current}
                uploadType={w.uploadType}
                ready={() => w.resourceReady}
                performedBy={w.performedBy}
                onSpeakerChange={w.setPerformedBy}
                inValue={w.markdownValue}
                eafUrl={w.eafUrl}
                defaultFilename={w.filename}
                pendingRestore={w.resourcePendingRestore}
                onFiles={w.handleResourceUploadFiles}
                deferred={
                  w.uploadType === UploadType.ProjectResource
                    ? { onNext: w.handleUploadStepNext, submitRef: w.submitRef }
                    : undefined
                }
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
              // If we went to step 3 and then Back, no need to re-upload the media.
              uploadsOnNext={w.isAddingAudioResource && !w.projMedia}
              uploading={w.uploading}
              onSelect={w.handleSectionsSelected}
              onBack={
                w.isAddingAudioResource ? w.handleSelectSectionsBack : undefined
              }
            />
          </Box>
          {/* Step 3: mounts only on its step: the wavesurfer player is expensive
          TODO cleanup: some changes have been made since that decision was made. See if it still
          makes sense to mount the configure step only when needed. */}
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
