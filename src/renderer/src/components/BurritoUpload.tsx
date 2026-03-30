import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Typography,
  Box,
} from '@mui/material';
import { useSnackBar, AlertSeverity } from '../hoc/SnackBar';
import path from 'path-browserify';
import { MainAPI } from '@model/main-api';
import { useSelector } from 'react-redux';
import { mainSelector, scriptureBurritoImportSelector } from '../selector';
import { shallowEqual } from 'react-redux';
import { IMainStrings, IScriptureBurritoImportStrings } from '@model/index';

const ipc = window?.api as MainAPI;

interface BurritoUploadDialogProps {
  open: boolean;
  onSubmit: (directoryPath: string, isZip: boolean) => void;
  onCancel: () => void;
  title?: string;
}

const BurritoUploadDialog: React.FC<BurritoUploadDialogProps> = ({
  open,
  onSubmit,
  onCancel,
  title,
}) => {
  const importStrings: IScriptureBurritoImportStrings = useSelector(
    scriptureBurritoImportSelector,
    shallowEqual
  );
  const mainStrings: IMainStrings = useSelector(mainSelector, shallowEqual);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isZipFile, setIsZipFile] = useState(false);
  const [zipFilePath, setZipFilePath] = useState<string | null>(null);
  const { showMessage } = useSnackBar();

  const handleBrowseDirectory = async () => {
    const result = await ipc.openDirectoryDialog();
    if (result && result[0]) {
      setSelectedPath(result[0]);
      setIsZipFile(false);
      setZipFilePath(null);
    }
  };

  const handleBrowseZip = async () => {
    const filePaths = await ipc?.importOpen([
      { name: 'zip', extensions: ['zip'] },
    ]);
    if (!filePaths || !filePaths[0]) {
      return;
    }

    setZipFilePath(filePaths[0]);
    setIsZipFile(true);
    setSelectedPath(filePaths[0]);
  };

  const handleSubmit = async () => {
    if (!selectedPath) return;

    setLoading(true);
    try {
      let extractPath = selectedPath;
      let isZip = false;

      // Extract zip if selected
      if (isZipFile && zipFilePath) {
        const tempPath = await ipc.temp();
        extractPath = path.join(tempPath, `burrito-${Date.now()}`);

        let zipId: string | undefined;
        try {
          zipId = await ipc.zipOpen(zipFilePath);
          const success = await ipc.zipExtract(zipId, extractPath, true);
          if (!success) {
            showMessage(importStrings.zipExtractError, AlertSeverity.Error);
            return;
          }
        } finally {
          if (zipId !== undefined) {
            try {
              await ipc.zipClose(zipId);
            } catch {
              /* avoid masking extraction errors */
            }
          }
        }

        // Check if contents are in a subdirectory
        const entries = await ipc.readDir(extractPath);
        if (entries.length === 1) {
          const firstEntry = entries[0];
          const firstEntryPath = path.join(extractPath, firstEntry);
          const subEntries = await ipc.readDir(firstEntryPath);
          if (subEntries.length > 0) {
            extractPath = firstEntryPath;
          }
        }
        isZip = true;
      }

      // Check for wrapper.json
      const wrapperPath = path.join(extractPath, 'wrapper.json');
      const wrapperExists = await ipc.exists(wrapperPath);
      if (!wrapperExists) {
        showMessage(importStrings.wrapperNotFoundError, AlertSeverity.Error);
        return;
      }

      // Read and validate wrapper.json
      const metadataContent = await ipc.read(wrapperPath, {
        encoding: 'utf-8',
      });
      const metadata = JSON.parse(metadataContent as string);

      if (metadata.format !== 'scripture burrito wrapper') {
        showMessage(
          importStrings.invalidWrapperMetadataError,
          AlertSeverity.Error
        );
        return;
      }

      onSubmit(extractPath, isZip);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? mainStrings.genericError.replace('{0}', error.message)
          : mainStrings.unexpectedError,
        AlertSeverity.Error
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedPath(null);
    setIsZipFile(false);
    setZipFilePath(null);
    onCancel();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle data-cy="burrito-upload-dialog-title">
        {title ?? importStrings.title}
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" gutterBottom>
          {importStrings.subtitle}
        </Typography>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <Button
            data-cy="burrito-upload-browse-directory"
            variant="outlined"
            onClick={handleBrowseDirectory}
            disabled={loading}
          >
            {importStrings.browseDirectory}
          </Button>

          <Button
            data-cy="burrito-upload-browse-zip"
            variant="outlined"
            onClick={handleBrowseZip}
            disabled={loading}
          >
            {importStrings.browseZipFile}
          </Button>
        </div>

        {selectedPath && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {importStrings.selected}
            </Typography>
            <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
              {path.basename(selectedPath)}
            </Typography>
          </Box>
        )}

        {loading && (
          <div style={{ marginTop: 16 }}>
            <LinearProgress />
          </div>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          data-cy="burrito-upload-cancel"
          onClick={handleClose}
          variant="outlined"
        >
          {mainStrings.cancel}
        </Button>
        <Button
          data-cy="burrito-upload-import"
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedPath || loading}
        >
          {mainStrings.import}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BurritoUploadDialog;
