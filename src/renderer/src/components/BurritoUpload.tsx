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
import { importSelector } from '../selector';
import { shallowEqual } from 'react-redux';
import { IImportStrings } from '@model/index';

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
  title = 'Import Scripture Burrito',
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const t: IImportStrings = useSelector(importSelector, shallowEqual);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isZipFile, setIsZipFile] = useState(false);
  const [zipFilePath, setZipFilePath] = useState<string | null>(null);
  const { showMessage } = useSnackBar();

  const handleBrowseDirectory = async () => {
    const result = await ipc.openDirectoryDialog();
    if (result && result[0]) {
      setSelectedPath(result[0]);
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

        const zipId = await ipc.zipOpen(zipFilePath);
        const success = await ipc.zipExtract(zipId, extractPath, true);
        if (!success) {
          showMessage('Failed to extract zip file', AlertSeverity.Error);
          return;
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

      // Check for metadata.json
      const metadataPath = path.join(extractPath, 'metadata.json');
      const metadataExists = await ipc.exists(metadataPath);
      if (!metadataExists) {
        showMessage(
          'metadata.json not found in the selected file/directory',
          AlertSeverity.Error
        );
        return;
      }

      // Read and validate metadata.json
      const metadataContent = await ipc.read(metadataPath, {
        encoding: 'utf-8',
      });
      const metadata = JSON.parse(metadataContent as string);

      if (metadata.format !== 'scripture burrito wrapper') {
        showMessage(
          'Invalid format: expected "scripture burrito wrapper"',
          AlertSeverity.Error
        );
        return;
      }

      onSubmit(extractPath);
    } catch (error) {
      showMessage(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      <DialogTitle>{title}</DialogTitle>

      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Select a Burrito directory or a .zip file to extract and import.
        </Typography>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <Button
            variant="outlined"
            onClick={handleBrowseDirectory}
            disabled={loading}
          >
            Browse Directory
          </Button>

          <Button
            variant="outlined"
            onClick={handleBrowseZip}
            disabled={loading}
          >
            Browse Zip File
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
              Selected {isZipFile ? 'zip file: ' : 'directory: '}
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
        <Button onClick={handleClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedPath || loading}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BurritoUploadDialog;
