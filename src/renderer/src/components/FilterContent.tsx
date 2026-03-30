import { useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IFilterContentStrings, IMainStrings } from '../model';
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
import { filterContentSelector, mediaUploadSelector } from '../selector';
import { TreeItem, SimpleTreeView } from '@mui/x-tree-view';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import {
  BookStructure,
  BURRITO_CHAPTER_FILTER_OTHER,
  WrapperStructure,
} from '../utils/parseBurritoMetadata';

/** Alias for tests and legacy imports; same shape as `WrapperStructure`. */
export type FilterData = WrapperStructure;

interface FilterProps {
  filterVisible: boolean;
  onFilterVisible: (v: boolean) => void;
  filterSubmit: (value: WrapperStructure | null) => void;
  filterData: WrapperStructure;
  uploadCancel?: (() => void) | undefined;
  cancelLabel?: string | undefined;
}

//TreeNode Type
type TreeNode = {
  id: string;
  label: string;
  type: 'chapter' | 'book' | 'burrito' | 'all';
  /** Underlying value to persist (e.g. burrito flavor name). */
  value?: string;
  children?: TreeNode[];
};

function FilterContent(props: FilterProps) {
  const {
    filterVisible,
    onFilterVisible,
    filterSubmit,
    filterData,
    uploadCancel,
  } = props;
  const mainStrings: IMainStrings = useSelector(
    mediaUploadSelector,
    shallowEqual
  );
  const filterStrings: IFilterContentStrings = useSelector(
    filterContentSelector,
    shallowEqual
  );
  const [checked, setChecked] = useState<string[]>([]);

  const cancelFilter = () => {
    filterSubmit(null);
    onFilterVisible(false);
    if (uploadCancel) {
      uploadCancel();
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    onFilterVisible(open);
    if (!open) {
      cancelFilter();
    }
  };

  const handleSavePreferences = () => {
    const books = savePreferences();
    const nextData: WrapperStructure = {
      ...filterData,
      books,
    };
    filterSubmit(nextData);
    onFilterVisible(false);
  };
  const handleCancel = () => {
    cancelFilter();
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
          id: `chps:${book.id}`,
          label: filterStrings.allChapters.replace('{0}', book.label),
          type: 'all',
          children: [],
        };
        children.push(item);
        book.chapters.forEach((c) => {
          item.children?.push({
            id: `ch:${book.id}:${c}`,
            label: c === BURRITO_CHAPTER_FILTER_OTHER ? filterStrings.other : c,
            value: c,
            type: 'chapter',
          });
        });
      } else {
        book.chapters.forEach((c) => {
          children.push({
            id: `ch:${book.id}:${c}`,
            label: c === BURRITO_CHAPTER_FILTER_OTHER ? filterStrings.other : c,
            value: c,
            type: 'chapter',
          });
        });
      }

      book.burritos.forEach((b) => {
        if (b !== 'APM Data') {
          // Does not display the "Apm Data" as a burrito for each book
          const label =
            b === 'audioTranslation'
              ? filterStrings.audioContent
              : b === 'textTranslation'
                ? filterStrings.transcriptionContent
                : b;
          children.push({
            id: `bur:${book.id}:${b}`,
            label,
            value: b,
            type: 'burrito',
          });
        }
      });
      bks.push({
        id: `book:${book.id}`,
        label: book.label,
        type: 'book',
        children: children,
      });
    });
    if (bks.length > 1) {
      const item: TreeNode = {
        id: 'books',
        label: filterStrings.allBooks,
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
  const savePreferences = (): BookStructure[] => {
    // flatten every branch in `data` and include the book nodes themselves
    const allNodes = data.flatMap((n) => getAllDescendants(n, true));
    const checkedNodes = allNodes.filter((node) => checked.includes(node.id));

    const selectedBookIds = new Set(
      checkedNodes
        .filter((n) => n.type === 'book')
        .map((n) =>
          n.id.startsWith('book:') ? n.id.slice('book:'.length) : ''
        )
        .filter(Boolean)
    );

    const selectedChaptersByBook = new Map<string, Set<string>>();
    const selectedBurritosByBook = new Map<string, Set<string>>();
    for (const node of checkedNodes) {
      if (node.type === 'chapter' && node.id.startsWith('ch:')) {
        const parts = node.id.split(':');
        const bookId = parts[1];
        const chapter = node.value ?? parts.slice(2).join(':');
        if (!bookId || !chapter) continue;
        if (!selectedChaptersByBook.has(bookId)) {
          selectedChaptersByBook.set(bookId, new Set());
        }
        selectedChaptersByBook.get(bookId)?.add(String(chapter));
      }
      if (node.type === 'burrito' && node.id.startsWith('bur:')) {
        const parts = node.id.split(':');
        const bookId = parts[1];
        const burrito = node.value ?? parts.slice(2).join(':');
        if (!bookId || !burrito) continue;
        if (!selectedBurritosByBook.has(bookId)) {
          selectedBurritosByBook.set(bookId, new Set());
        }
        selectedBurritosByBook.get(bookId)?.add(String(burrito));
      }
    }

    return filterData.books
      .filter((book) => selectedBookIds.has(book.id))
      .map((book) => {
        const selectedChapters =
          selectedChaptersByBook.get(book.id) ?? new Set<string>();
        const selectedBurritos =
          selectedBurritosByBook.get(book.id) ?? new Set<string>();

        return {
          ...book,
          chapters: book.chapters.filter((chp) => selectedChapters.has(chp)),
          burritos: book.burritos.filter((bur) => selectedBurritos.has(bur)),
        };
      });
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
      onOpen={handleDialogOpenChange}
      title={filterStrings.title.replace('{0}', filterData.label)}
      bp={BigDialogBp.sm}
    >
      <>
        <DialogContent>
          <DialogContentText>
            {filterStrings.subtitle1}
            <br />
            {filterStrings.subtitle2}
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
            {mainStrings.cancel}
          </Button>
          <Button
            id="filterSave"
            onClick={handleSavePreferences}
            variant="contained"
            color="primary"
            disabled={false}
          >
            {mainStrings.upload}
          </Button>
        </DialogActions>
      </>
    </BigDialog>
  );
}

export default FilterContent;
