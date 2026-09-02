import React, { useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IMediaUploadStrings } from '../model';
import {
  Box,
  DialogActions,
  DialogContent,
  DialogContentText,
  LinearProgress,
  styled,
} from '@mui/material';
import path from 'path-browserify';
import { useSnackBar } from '../hoc/SnackBar';
import SpeakerName from './SpeakerName';
import { mediaUploadSelector } from '../selector';
import { LinkEdit } from '../control/LinkEdit';
import { MarkDownEdit } from '../control/MarkDownEdit';
import { isUrl } from '../utils';
import { filterFilesBySizeLimit } from '../utils/filterFilesBySizeLimit';
import { typeLimit } from '../utils/typeLimit';
import { FaithbridgeType, MarkDownType, UriLinkType } from './MediaUpload';
import { UploadType } from './UploadType';
import { FileDrop } from 'react-file-drop';
import { Button } from '../control/Button';

const MyLabel = styled('label')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  flexGrow: 1,
  backgroundColor: theme.palette.grey[500],
  border: 'none',
  padding: theme.spacing(2),
}));

const Drop = styled('div')(({ theme }) => ({
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: theme.palette.secondary.light,
  padding: theme.spacing(1),
  margin: theme.spacing(1),
}));

const HiddenInput = styled('input')(() => ({
  display: 'none',
}));

// Accepted file formats, indexed by UploadType
const uploadExtensions = [
  '.mp3, .m4a, .wav, .ogg', // Media
  '.mp3, .m4a, .wav, .ogg, .pdf', // Resource
  '.itf', // ITF
  '.ptf', // PTF
  '.jpg, .jpeg, .svg, .png', // LOGO
  '.mp3, .m4a, .wav, .ogg, .pdf', // ProjectResource
  '.mp3, .m4a, .wav, .ogg, .pdf, .png, .jpg, .jpeg', // IntellectualProperty
  '.png, .jpg, .jpeg, .webp', // Graphic
  '', // Link
  '', // MarkDown
  '', // FaithbridgeLink
];

const uploadMimeTypes = [
  'audio/mpeg, audio/wav, audio/x-m4a, audio/ogg', // Media
  'audio/mpeg, audio/wav, audio/x-m4a, audio/ogg, application/pdf', // Resource
  'application/itf', // ITF
  'application/ptf', // PTF
  'image/jpeg, image/jpeg, image/svg+xml, image/png', // LOGO
  'audio/mpeg, audio/wav, audio/x-m4a, audio/ogg, application/pdf', // ProjectResource
  'audio/mpeg, audio/wav, audio/x-m4a, audio/ogg, application/pdf, image/png, image/jpeg, image/jpeg', // IntellectualProperty
  'image/png, image/jpeg, image/jpeg, image/webp', // Graphic
  '', // Link
  '', // MarkDown
  '', // FaithbridgeLink
];

interface ITargetProps {
  name: string;
  acceptextension: string;
  acceptmime: string;
  multiple?: boolean;
  handleFiles: (files: FileList | undefined) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const DropTarget = (targetProps: ITargetProps) => {
  const { name, multiple, acceptextension, acceptmime, handleFiles, inputRef } =
    targetProps;
  const t: IMediaUploadStrings = useSelector(mediaUploadSelector, shallowEqual);

  const handleNameChange = (
    e: React.FormEvent<HTMLInputElement | HTMLLabelElement>
  ) => {
    const inputEl = e.target as HTMLInputElement;
    if (inputEl && inputEl.files) {
      handleFiles(inputEl.files);
    }
  };

  const handleDrop = (files: FileList | null) => {
    if (files) handleFiles(files);
  };
  return process.env.NODE_ENV !== 'test' ? (
    <FileDrop onDrop={handleDrop}>
      <MyLabel id="file" htmlFor="upload" onChange={handleNameChange}>
        {name === ''
          ? multiple
            ? t.dragDropMultiple
            : t.dragDropSingle
          : name}
      </MyLabel>
      <HiddenInput
        ref={inputRef}
        id="upload"
        type="file"
        accept={acceptextension}
        multiple={multiple}
        onChange={handleNameChange}
      />
    </FileDrop>
  ) : (
    <div>
      <MyLabel id="file" htmlFor="upload" onChange={handleNameChange}>
        {name === ''
          ? multiple
            ? t.dragDropMultiple
            : t.dragDropSingle
          : name}
      </MyLabel>
      <HiddenInput
        ref={inputRef}
        id="upload"
        type="file"
        accept={acceptmime}
        multiple={multiple}
        onChange={handleNameChange}
      />
    </div>
  );
};

export interface MediaUploadControlsRef {
  handleAddOrSave: (() => void) | null;
  handleCancel: (() => void) | null;
}

interface IProps {
  onVisible: (v: boolean) => void;
  uploadType: UploadType;
  uploadMethod?:
    ((files: File[]) => void | boolean | Promise<void | boolean>) | undefined;
  multiple?: boolean | undefined;
  cancelMethod?: (() => void) | undefined;
  cancelLabel?: string | undefined;
  metaData?: React.JSX.Element | undefined;
  ready?: (() => boolean) | undefined;
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  team?: string | undefined; // used to check for speakers when adding a card
  onFiles?: ((files: File[]) => void) | undefined;
  inValue?: string | undefined;
  onValue?: ((value: string) => void) | undefined;
  onNonAudio?: ((nonAudio: boolean) => void) | undefined;
  saveText?: string | undefined;
  controlsRef?: React.RefObject<MediaUploadControlsRef>;
  onSaveDisabled?: ((disabled: boolean) => void) | undefined;
  /** When true, render `DialogContent`/`DialogActions` without the wrapping Box
   *  so they are direct children of a shared Dialog paper (MUI flex handles the
   *  scroll region + pinned actions, matching the record body).
   *  TODO future work: I would like to see if we can get rid of the wrapper altogether,
   * but don't have time to check all the usages now. */

  noWrapper?: boolean | undefined;
}

function MediaUploadContent(props: IProps) {
  const {
    onVisible,
    uploadType,
    multiple,
    uploadMethod,
    cancelMethod,
    cancelLabel,
    metaData,
    ready,
    speaker,
    onSpeaker,
    team,
    onFiles,
    inValue,
    onValue,
    onNonAudio,
    saveText,
    controlsRef,
    onSaveDisabled,
    noWrapper,
  } = props;
  const [name, setName] = useState('');
  const [files, setFilesx] = useState<File[]>([]);
  const filesRef = useRef(files);
  const { showMessage } = useSnackBar();
  const [acceptextension, setAcceptExtension] = useState('');
  const [acceptmime, setAcceptMime] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasRights, setHasRight] = useState(!onSpeaker || Boolean(speaker));
  const [progress, setProgress] = useState(false);
  const t: IMediaUploadStrings = useSelector(mediaUploadSelector, shallowEqual);
  const text = [
    t.task,
    t.resourceTask,
    t.ITFtask,
    t.PTFtask,
    'FUTURE TODO',
    t.projectResourceTask,
    t.intellectualPropertyTask,
    t.graphicTask,
    t.linkTask,
    t.markdownTask,
    t.faithbridgeTitle,
  ];

  const handleAddOrSave = async () => {
    if (!uploadMethod || !files) return;

    setProgress(true);
    try {
      const started = await Promise.resolve(uploadMethod(files));
      // If the upload method indicates “nothing started” (e.g. async validation failed),
      // keep the file selected and re-enable the dialog.
      if (started === false) {
        setProgress(false);
        return;
      }
      // Historical behavior: clear selection after initiating an upload.
      handleFiles(undefined);
    } catch {
      setProgress(false);
    }
  };
  const handleCancel = () => {
    handleFiles(undefined);
    if (cancelMethod) {
      cancelMethod();
    }
    onVisible(false);
  };
  const saveDisabled = useMemo(
    () =>
      (ready && !ready()) ||
      !files ||
      files.length === 0 ||
      (files[0] as File).name.trim() === '' ||
      !hasRights ||
      (uploadType === UploadType.Link && !isUrl((files[0] as File).name)) ||
      progress,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, files, hasRights, uploadType, isUrl, progress]
  );

  useEffect(() => {
    onSaveDisabled?.(saveDisabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveDisabled]);

  const clearFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const setFiles = (f: File[]) => {
    filesRef.current = f;
    setFilesx(f);
    onFiles && onFiles(f);
  };
  const fileName = (files: File[]) => {
    return files.length === 0
      ? ''
      : files.length === 1
        ? (files[0] as File).name
        : files.length.toString() + ' files selected';
  };
  const checkSizes = (files: File[], sizelimit: number) => {
    const { accepted, rejected } = filterFilesBySizeLimit(files, sizelimit);
    if (rejected.length > 0) {
      showMessage(
        t.toobig
          .replace('{0}', rejected.map((f) => f.name).join(', '))
          .replace('{1}', sizelimit.toString())
      );
    }
    return accepted;
  };
  const handleFiles = (files: FileList | undefined) => {
    if (files) {
      let goodFiles = Array.from(files).filter((s) =>
        acceptextension.includes(
          (path.extname(s.name) || '.xxx').substring(1).toLowerCase()
        )
      );
      if (goodFiles.length < files.length) {
        const rejectedFiles = Array.from(files).filter(
          (s) =>
            !acceptextension.includes(
              (path.extname(s.name) || '.xxx').substring(1).toLowerCase()
            )
        );
        showMessage(
          t.invalidFile.replace(
            '{0}',
            rejectedFiles.map((f) => f.name).join(', ')
          )
        );
      }
      const nonAudio = goodFiles.some((f) => !f?.type.includes('audio'));
      if (onNonAudio) onNonAudio(nonAudio);
      goodFiles = checkSizes(goodFiles, typeLimit(uploadType));
      setName(fileName(goodFiles));
      setFiles(goodFiles);
      if (goodFiles.length === 0) {
        clearFileInput();
      }
    } else {
      setFiles([]);
      setName('');
      clearFileInput();
    }
  };

  const handleRights = (hasRights: boolean) => setHasRight(hasRights);
  const handleSpeaker = (speaker: string) => {
    onSpeaker && onSpeaker(speaker);
  };
  const handleValue = (newValue: string) => {
    const type =
      uploadType !== UploadType.MarkDown ? UriLinkType : MarkDownType;
    setFiles([{ name: newValue, size: newValue.length, type } as File]);
    onValue && onValue(newValue);
  };

  useEffect(() => {
    if (controlsRef !== undefined) {
      controlsRef.current.handleAddOrSave = handleAddOrSave;
      controlsRef.current.handleCancel = handleCancel;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleAddOrSave, handleCancel]);

  useEffect(() => setProgress(false), []);

  useEffect(() => {
    if (inValue) {
      setFiles([
        {
          name: inValue,
          size: inValue.length,
          type:
            uploadType !== UploadType.MarkDown
              ? uploadType === UploadType.FaithbridgeLink
                ? FaithbridgeType
                : UriLinkType
              : MarkDownType,
        } as File,
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inValue]);

  useEffect(() => {
    setAcceptExtension(uploadExtensions[uploadType] ?? '');
    setAcceptMime(uploadMimeTypes[uploadType] ?? '');
    const size = typeLimit(uploadType);
    clearFileInput();
    if (filesRef.current.length > 0) {
      const goodFiles = checkSizes(filesRef.current, size);
      setName(fileName(goodFiles));
      setFiles(goodFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadType]);

  const body = (
    <>
      <DialogContent>
        <DialogContentText>
          {(text[uploadType] as string).replace('{0}', speaker || '')}
        </DialogContentText>
        {onSpeaker && uploadType === UploadType.Media && (
          <SpeakerName
            name={hasRights ? speaker || '' : ''}
            onRights={handleRights}
            onChange={handleSpeaker}
            team={team}
            aiip={false}
          />
        )}
        {![
          UploadType.Link,
          UploadType.MarkDown,
          UploadType.FaithbridgeLink,
        ].includes(uploadType) ? (
          <Drop>
            {hasRights ? (
              <DropTarget
                name={name}
                handleFiles={handleFiles}
                acceptextension={acceptextension}
                acceptmime={acceptmime}
                multiple={multiple ?? false}
                inputRef={fileInputRef}
              />
            ) : (
              <MyLabel>{'\u00A0'}</MyLabel>
            )}
          </Drop>
        ) : uploadType === UploadType.Link ? (
          <LinkEdit inValue={inValue ?? ''} onValue={handleValue} />
        ) : uploadType === UploadType.MarkDown ? (
          <MarkDownEdit inValue={inValue ?? ''} onValue={handleValue} />
        ) : (
          <></>
        )}
        {metaData}
        {progress && <LinearProgress variant="indeterminate" />}
      </DialogContent>
      {!controlsRef && (
        <DialogActions>
          <Button
            id="uploadCancel"
            onClick={handleCancel}
            variant="outlined"
            color="primary"
          >
            {cancelLabel || t.cancel}
          </Button>
          <Button
            id="uploadSave"
            onClick={handleAddOrSave}
            variant="contained"
            color="primary"
            disabled={saveDisabled}
            sx={{ minWidth: '96px' }}
          >
            {saveText || t.upload}
          </Button>
        </DialogActions>
      )}
    </>
  );

  return noWrapper ? (
    body
  ) : (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
    >
      {body}
    </Box>
  );
}

export default MediaUploadContent;
