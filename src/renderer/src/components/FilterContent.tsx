import React, { useEffect, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IMediaUploadStrings } from '../model';
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useSnackBar } from '../hoc/SnackBar';
import { mediaUploadSelector } from '../selector';
import { isUrl } from '../utils';
import {
  FaithbridgeType,
  MarkDownType,
  SIZELIMIT,
  UriLinkType,
} from './MediaUpload';
import { UploadType } from './UploadType';
import { TreeItem, SimpleTreeView } from '@mui/x-tree-view';

interface IProps {
  onVisible: (v: boolean) => void;
  uploadType: UploadType;
  uploadMethod?: ((files: File[]) => void) | undefined;
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
}

function FilterContent(props: IProps) {
  const {
    onVisible,
    uploadType,
    uploadMethod,
    cancelMethod,
    cancelLabel,
    ready,
    onFiles,
    inValue,
    saveText,
  } = props;
  // const [allBooks, setAllBooks] = useState(false);
  // const [someBooks, setSomeBooks] = useState(false);
  // const [book1, setBook1] = useState(false);
  // const [book2, setBook2] = useState(false);
  const [files, setFilesx] = useState<File[]>([]);
  const filesRef = useRef(files);
  const { showMessage } = useSnackBar();
  const [progress, setProgress] = useState(false);
  const t: IMediaUploadStrings = useSelector(mediaUploadSelector, shallowEqual);

  const handleAddOrSave = () => {
    if (uploadMethod && files) {
      setProgress(true);
      uploadMethod(files);
    }
  };
  const handleCancel = () => {
    if (cancelMethod) {
      cancelMethod();
    }
    onVisible(false);
  };

  // const handleAllBooks = () => {
  //   if (!allBooks) {
  //     setAllBooks(!allBooks);
  //   } else {
  //     setSomeBooks(!allBooks);
  //   }
  // };
  // const handleBook1 = () => {
  //   setBook1(!book1);
  // };
  // const handleBook2 = () => {
  //   setBook2(!book2);
  // };

  const setFiles = (f: File[]) => {
    filesRef.current = f;
    setFilesx(f);
    onFiles && onFiles(f);
  };
  const checkSizes = (files: File[], sizelimit: number) => {
    const smallenoughfiles = Array.from(
      files.filter((s) => s.size <= sizelimit * 1000000)
    );
    if (smallenoughfiles.length < files.length) {
      const rejectedFiles = Array.from(files).filter(
        (s) => s.size > sizelimit * 1000000
      );
      showMessage(
        t.toobig
          .replace('{0}', rejectedFiles.map((f) => f.name).join(', '))
          .replace('{1}', sizelimit.toString())
      );
    }
    return smallenoughfiles;
  };

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
    const size = SIZELIMIT(uploadType);
    if (filesRef.current.length > 0) {
      const goodFiles = checkSizes(filesRef.current, size);
      setFiles(goodFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadType]);

  const data = [
    {
      id: 'books',
      label: 'All Books',
      children: [
        {
          id: 'ruth',
          label: 'Ruth',
          children: [
            {
              id: 'chps_ruth',
              label: 'All Chapters',
              children: [
                { id: 'ruth_chp1', label: 'Chapter 1' },
                { id: 'ruth_chp2', label: 'Chapter 2' },
                { id: 'ruth_chp3', label: 'Chapter 3' },
              ],
            },
            { id: 'ruth_audio', label: 'Audio' },
            { id: 'ruth_nav', label: 'Navigation' },
            { id: 'ruth_notes', label: 'Notes' },
            { id: 'ruth_resrc', label: 'Resources' },
            { id: 'ruth_text', label: 'Text' },
          ],
        },
        {
          id: 'jonah',
          label: 'Jonah',
          children: [
            {
              id: 'chps_jonah',
              label: 'All Chapters',
              children: [
                { id: 'jonah_chp1', label: 'Chapter 1' },
                { id: 'jonah_chp2', label: 'Chapter 2' },
                { id: 'jonah_chp3', label: 'Chapter 3' },
              ],
            },
            { id: 'jonah_audio', label: 'Audio' },
            { id: 'jonah_nav', label: 'Navigation' },
            { id: 'jonah_notes', label: 'Notes' },
            { id: 'jonah_resrc', label: 'Resources' },
            { id: 'jonah_text', label: 'Text' },
          ],
        },
      ],
    },
  ];
  const [checked, setChecked] = React.useState<string[]>([]);

  const getAllDescendantIds = (node: any): string[] => {
    const ids = [node.id];
    if (Array.isArray(node.children)) {
      node.children.forEach((child: any) => {
        ids.push(...getAllDescendantIds(child));
      });
    }
    return ids;
  };

  const handleToggle = (nodeId: any, node?: any) => {
    setChecked((prev) => {
      const isChecked = prev.includes(nodeId);
      const nodesToToggle = node ? getAllDescendantIds(node) : [nodeId];

      if (isChecked) {
        // Remove this node and all descendants
        return prev.filter((id) => !nodesToToggle.includes(id));
      } else {
        // Add this node and all descendants
        return [...prev, ...nodesToToggle.filter((id) => !prev.includes(id))];
      }
    });
  };
  // TODO - Needs to return the data after the checkbox tree is checked w/ the upload button
  const renderTree = (nodes: any) => (
    <TreeItem
      key={nodes.id}
      itemId={nodes.id}
      slots={{
        collapseIcon: ExpandMoreIcon,
        expandIcon: ChevronRightIcon,
      }}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Checkbox
            checked={checked.includes(nodes.id)}
            onChange={() => handleToggle(nodes.id, nodes)}
            onClick={(e) => e.stopPropagation()}
          />
          {nodes.label}
        </Box>
      }
    >
      {Array.isArray(nodes.children)
        ? nodes.children.map((node: any) => renderTree(node))
        : null}
    </TreeItem>
  );

  return (
    <>
      <DialogContent>
        <DialogContentText>
          {"This text box is not very great right now, but we tryin'."}
        </DialogContentText>
        <SimpleTreeView>{data.map((node) => renderTree(node))}</SimpleTreeView>
      </DialogContent>
      <DialogActions>
        <Button
          id="filterCancel"
          onClick={handleCancel}
          variant="outlined"
          color="primary"
        >
          {cancelLabel || t.cancel}
        </Button>
        <Button
          id="filterSave"
          onClick={handleAddOrSave}
          variant="contained"
          color="primary"
          disabled={
            (ready && !ready()) ||
            !files ||
            files.length === 0 ||
            (files[0] as File).name.trim() === '' ||
            (uploadType === UploadType.Link &&
              !isUrl((files[0] as File).name)) ||
            progress
          }
        >
          {saveText || t.upload}
        </Button>
      </DialogActions>
    </>
  );
}

export default FilterContent;
