import { useState } from 'react';
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
import { mediaUploadSelector } from '../selector';
import { UploadType } from './UploadType';
import { TreeItem, SimpleTreeView } from '@mui/x-tree-view';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';

interface FilterProps {
  visible: boolean;
  onVisible: (v: boolean) => void;
  uploadType: UploadType;
  onChange: (value: string[]) => void;
  filterData: any;
  cancelMethod?: (() => void) | undefined;
  cancelLabel?: string | undefined;
}

function FilterContent(props: FilterProps) {
  const {
    visible,
    onVisible,
    onChange,
    filterData,
    cancelMethod,
    cancelLabel,
  } = props;
  // const [allBooks, setAllBooks] = useState(false);
  // const [someBooks, setSomeBooks] = useState(false);
  // const [book1, setBook1] = useState(false);
  // const [book2, setBook2] = useState(false);
  const t: IMediaUploadStrings = useSelector(mediaUploadSelector, shallowEqual);
  const [checked, setChecked] = useState<string[]>([]);

  const handleSavePreferences = () => {
    const fdata = savePreferences();
    console.log(fdata);
    onChange(checked);
    handleCancel(); // closes dialog - hopefully doesn't cancel everything else
  };
  const handleCancel = () => {
    if (cancelMethod) {
      cancelMethod();
    }
    onVisible(false);
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

  const getAllDescendantIds = (node: any): string[] => {
    const ids = [node.id];
    if (Array.isArray(node.children)) {
      node.children.forEach((child: any) => {
        ids.push(...getAllDescendantIds(child));
      });
    }
    return ids;
  };
  const convertDataToTreeForm = () => {
    data = filterData; // TODO - do later
  };
  const savePreferences = () => {
    console.log(data);
    const returnData = [];
    for (const i of checked) {
      returnData.push(i);
    }
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

  let data = [
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

  return (
    <BigDialog
      isOpen={visible}
      onOpen={handleCancel}
      title={'This is temporary Title'}
      bp={BigDialogBp.sm}
    >
      <>
        <DialogContent>
          <DialogContentText>
            {"This text box is not very great right now, but we tryin'."}
          </DialogContentText>
          <SimpleTreeView>
            {data.map((node) => renderTree(node))}
          </SimpleTreeView>
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
            onClick={handleSavePreferences}
            variant="contained"
            color="primary"
            disabled={false}
          >
            {t.upload}
          </Button>
        </DialogActions>
      </>
    </BigDialog>
  );
}

export default FilterContent;
