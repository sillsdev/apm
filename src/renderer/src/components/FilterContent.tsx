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
import { TreeItem, SimpleTreeView } from '@mui/x-tree-view';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import { BookStructure, WrapperStructure } from '../utils/parseBurritoMetadata';

interface FilterProps {
  filterVisible: boolean;
  onFilterVisible: (v: boolean) => void;
  filterSubmit: (value: WrapperStructure) => void;
  filterData: WrapperStructure;
  uploadCancel?: (() => void) | undefined;
  cancelLabel?: string | undefined;
}

//TreeNode Type
type TreeNode = {
  id: string;
  label: string;
  type: 'chapter' | 'book' | 'burrito' | 'all';
  children?: TreeNode[];
};

function FilterContent(props: FilterProps) {
  const {
    filterVisible,
    onFilterVisible,
    filterSubmit,
    filterData,
    uploadCancel,
    cancelLabel,
  } = props;
  const t: IMediaUploadStrings = useSelector(mediaUploadSelector, shallowEqual);
  const [checked, setChecked] = useState<string[]>([]);

  const handleSavePreferences = () => {
    const fdata = savePreferences();
    const tempData = filterData;
    // eslint-disable-next-line react-hooks/immutability
    tempData.books = fdata;
    filterSubmit(tempData);
    onFilterVisible(false);
  };
  const handleCancel = () => {
    if (uploadCancel) {
      uploadCancel();
    }
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
  // Return a flat list containing the specified node and all of its descendants.
  const getAllDescendants = (
    node: TreeNode,
    includeRoot = false
  ): TreeNode[] => {
    const result: TreeNode[] = [];

    const recurse = (n: TreeNode) => {
      result.push(n);
      if (Array.isArray(n.children)) {
        n.children.forEach(recurse);
      }
    };

    if (includeRoot) {
      recurse(node);
    } else if (Array.isArray(node.children)) {
      node.children.forEach(recurse);
    }

    return result;
  };
  const convertDataToTreeForm = (): TreeNode[] => {
    let filters: TreeNode[] = [];
    const bks: TreeNode[] = [];
    filterData.books.forEach((book) => {
      const children: TreeNode[] = [];
      if (book.chapters.length > 1) {
        const item: TreeNode = {
          id: 'chps' + book.label,
          label: 'All Chapters of ' + book.label,
          type: 'all',
          children: [],
        };
        children.push(item);
        book.chapters.forEach((c) => {
          item.children?.push({
            id: c + book.label,
            label: c,
            type: 'chapter',
          });
        });
      } else {
        book.chapters.forEach((c) => {
          children.push({ id: c + book.label, label: c, type: 'chapter' });
        });
      }

      book.burritos.forEach((b) => {
        if (b != 'APM Data') {
          // Does not display the "Apm Data" as a burrito for each book
          children.push({ id: b + book.label, label: b, type: 'burrito' });
        }
      });
      bks.push({
        id: book.label,
        label: book.label,
        type: 'book',
        children: children,
      });
    });
    if (bks.length > 1) {
      const item: TreeNode = {
        id: 'books',
        label: 'All Books',
        type: 'all',
        children: [],
      };
      item.children = bks;
      filters = [item];
    } else {
      filters = bks;
    }
    return filters;
  };
  const checkedNodeLabels = () => {
    // flatten every branch in `data` and include the book nodes themselves
    const allNodes = data.flatMap((n) => getAllDescendants(n, true));
    return allNodes
      .filter((node) => checked.includes(node.id))
      .map((node) => node.label);
  };
  const savePreferences = (): BookStructure[] => {
    const checkedLabels = checkedNodeLabels();
    const returnData = filterData.books.filter((book) =>
      checkedLabels.includes(book.label)
    );
    for (let i = 0; i < returnData.length; i++) {
      returnData[i].chapters = returnData[i].chapters.filter((chp) =>
        checkedLabels.includes(chp)
      );
      returnData[i].burritos = returnData[i].burritos.filter((bur) =>
        checkedLabels.includes(bur)
      );
    }
    return returnData;
  };

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
      isOpen={filterVisible}
      onOpen={handleCancel}
      title={'Scripture Burrito: ' + filterData.label}
      bp={BigDialogBp.sm}
    >
      <>
        <DialogContent>
          <DialogContentText>
            {'Please select the information you want to import into your team.'}
            <br />
            {'Each selected book will be imported as a separate project.'}
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
