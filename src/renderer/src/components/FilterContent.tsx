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
  filterData: FilterData;
  cancelMethod?: (() => void) | undefined;
  cancelLabel?: string | undefined;
}

// Set types here for filter data.
type FilterData = {
  books: filterBook[];
};
type filterBook = {
  id?: string;
  label: string;
  chapters: string[];
  burritos: string[];
};
//TreeNode Type
type TreeNode = {
  id: string;
  label: string;
  children?: TreeNode[] | filterBook[]; // either node or book entries are allowed
};

function FilterContent(props: FilterProps) {
  const {
    visible,
    onVisible,
    onChange,
    filterData,
    cancelMethod,
    cancelLabel,
  } = props;
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
  const convertDataToTreeForm = (): TreeNode[] => {
    let filters: TreeNode[] = [];
    const bks: filterBook[] = [];
    const chps: string[] = [];
    const burs: string[] = [];
    filterData.books.forEach((book) => {
      book.chapters.forEach((c) => {
        chps.push(c);
      });
      book.burritos.forEach((b) => {
        burs.push(b);
      });
      bks.push({
        id: book.label,
        label: book.label,
        chapters: chps,
        burritos: burs,
      });
    });
    if (filterData.books.length > 1) {
      const item: TreeNode = { id: 'books', label: 'All Books', children: [] };
      item.children = bks;
      filters = [item];
    } else {
      filters = bks as unknown as TreeNode[];
    }
    return filters;
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

  // declare `data` as an array of TreeNode. It can be initialized empty or via `convertDataToTreeForm`.
  let data: TreeNode[] = [];
  // if you want to populate immediately from filterData call the converter here:
  data = convertDataToTreeForm();

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
