import React, { useCallback, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import { AltButton } from '../control';
import { shallowEqual, useSelector } from 'react-redux';
import { graphicStringsSelector } from '../selector';
import { IGraphicStrings } from '@model/index';

/** Scripture reference for the filter: book, chapter, verse range (e.g. "1-25"). */
export interface ScriptureReferenceFilter {
  bookName: string;
  chapterNumbers: string;
  verseRange: string;
}

/** Which parts of the scripture reference are selected (filter by book/chapter/verse). */
export interface ScriptureRefChecked {
  book: boolean;
  chapter: boolean;
  verse: boolean;
}

export type GraphicImageSortBy = 'scripture' | 'newest';

export interface GraphicImageFilterState {
  sortBy: GraphicImageSortBy;
  selectedStyles: string[];
  selectedKeywords: string[];
  scriptureRefChecked: ScriptureRefChecked;
}

// const defaultScriptureRefChecked: ScriptureRefChecked = {
//   book: false,
//   chapter: false,
//   verse: false,
// };

// const defaultFilterState: GraphicImageFilterState = {
//   sortBy: 'newest',
//   selectedStyles: [],
//   selectedKeywords: [],
//   scriptureRefChecked: { ...defaultScriptureRefChecked },
// };

/** Reusable checkbox list: optional search at top, optional "All" row, then one checkbox per item. */
function CheckboxList({
  items,
  selectedSet,
  onSelectionChange,
  showSearch = false,
  showAllOption = false,
  allLabel = 'All',
  idPrefix = 'list',
}: {
  items: string[];
  selectedSet: Set<string>;
  onSelectionChange: (selected: string[]) => void;
  showSearch?: boolean;
  showAllOption?: boolean;
  allLabel?: string;
  idPrefix?: string;
}) {
  const [search, setSearch] = useState('');
  const t: IGraphicStrings = useSelector(graphicStringsSelector, shallowEqual);
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((item) => item.toLowerCase().includes(q));
  }, [items, search]);

  const allChecked = items.length > 0 && selectedSet.size === items.length;

  const handleToggle = useCallback(
    (item: string) => {
      const next = new Set(selectedSet);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      onSelectionChange(Array.from(next));
    },
    [selectedSet, onSelectionChange]
  );

  const handleToggleAll = useCallback(() => {
    if (allChecked) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...items]);
    }
  }, [allChecked, items, onSelectionChange]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {showSearch && (
        <TextField
          size="small"
          placeholder={t.placeHolder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 0.5 }}
          aria-label={t.placeHolder}
        />
      )}
      <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
        {showAllOption && items.length > 0 && (
          <ListItem disablePadding>
            <ListItemButton
              role={undefined}
              onClick={handleToggleAll}
              dense
              id={`${idPrefix}-all`}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox
                  edge="start"
                  checked={allChecked}
                  indeterminate={selectedSet.size > 0 && !allChecked}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={allLabel} />
            </ListItemButton>
          </ListItem>
        )}
        {filteredItems.map((item) => (
          <ListItem key={item} disablePadding>
            <ListItemButton
              role={undefined}
              onClick={() => handleToggle(item)}
              dense
              id={`${idPrefix}-${item.replace(/\s/g, '-')}`}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox
                  edge="start"
                  checked={selectedSet.has(item)}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={item} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export interface GraphicImageFilterProps {
  /** Anchor element id or the button is used as anchor. */
  anchorEl?: HTMLElement | null;
  /** Whether the Filters panel is open (controlled). */
  open: boolean;
  /** Called when the panel open state should change (e.g. close). */
  onOpenChange: (open: boolean) => void;
  /** Sort By value. */
  sortBy: GraphicImageSortBy;
  /** Called when Sort By changes. */
  onSortByChange: (value: GraphicImageSortBy) => void;
  /** Full list of style options. */
  styles: string[];
  /** Currently selected styles. */
  selectedStyles: string[];
  /** Called when style selection changes. */
  onStylesChange: (selected: string[]) => void;
  /** Full list of keyword options. */
  keywords: string[];
  /** Currently selected keywords. */
  selectedKeywords: string[];
  /** Called when keyword selection changes. */
  onKeywordsChange: (selected: string[]) => void;
  /** Scripture reference to display (book, chapter, verse range). */
  scriptureReference: ScriptureReferenceFilter | null;
  /** Which parts of the reference are checked. */
  scriptureRefChecked: ScriptureRefChecked;
  /** Called when scripture reference checkboxes change. */
  onScriptureRefCheckedChange: (checked: ScriptureRefChecked) => void;
  /** Called when Clear is clicked. */
  onClear: () => void;
  /** Called when Reset to Default is clicked. */
  onResetToDefault: () => void;
  /** Whether any filter is active (shows dot on filter icon). */
  filterActive?: boolean;
  /** Whether to override the scripture reference. */
  refOverride?: boolean;
  /** Optional labels */
  labels?: {
    filters?: string;
    sortBy?: string;
    scripture?: string;
    newest?: string;
    styles?: string;
    keywords?: string;
    clear?: string;
    resetToDefault?: string;
  };
}

const DEFAULT_LABELS = {
  filters: 'Filters',
  sortBy: 'Sort By',
  scripture: 'Scripture',
  newest: 'Newest',
  styles: 'Styles',
  keywords: 'Keywords',
  clear: 'Clear',
  resetToDefault: 'Reset to Default',
};

/**
 * Filter icon button that opens a Filters panel with Sort By, Styles, Scripture, and Keywords.
 * Uses controlled state for all filter values.
 */
export function GraphicImageFilter({
  anchorEl: anchorElProp,
  open,
  onOpenChange,
  sortBy,
  onSortByChange,
  styles,
  selectedStyles,
  onStylesChange,
  keywords,
  selectedKeywords,
  onKeywordsChange,
  scriptureReference,
  scriptureRefChecked,
  onScriptureRefCheckedChange,
  onClear,
  onResetToDefault,
  filterActive = false,
  refOverride = false,
  labels: labelsProp,
}: GraphicImageFilterProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const effectiveAnchor = anchorElProp ?? anchorEl;
  const labels = { ...DEFAULT_LABELS, ...labelsProp };

  const handleFilterClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (anchorElProp != null) return;
      setAnchorEl(event.currentTarget);
      onOpenChange(true);
    },
    [anchorElProp, onOpenChange]
  );

  const handleClose = useCallback(() => {
    if (anchorElProp == null) setAnchorEl(null);
    onOpenChange(false);
  }, [anchorElProp, onOpenChange]);

  const openState = open;
  const panelOpen =
    openState && (effectiveAnchor != null || anchorElProp != null);

  const selectedStylesSet = useMemo(
    () => new Set(selectedStyles),
    [selectedStyles]
  );
  const selectedKeywordsSet = useMemo(
    () => new Set(selectedKeywords),
    [selectedKeywords]
  );

  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  const handleReset = useCallback(() => {
    onResetToDefault();
  }, [onResetToDefault]);

  return (
    <>
      <Badge
        badgeContent={filterActive ? ' ' : 0}
        overlap="circular"
        variant="dot"
        color="primary"
      >
        <IconButton
          onClick={handleFilterClick}
          aria-label={labels.filters}
          title={labels.filters}
          color="primary"
          size="small"
          aria-haspopup="true"
          aria-expanded={panelOpen}
          id="graphic-image-filter-button"
        >
          <FilterListIcon />
        </IconButton>
      </Badge>
      <Popover
        open={panelOpen}
        anchorEl={effectiveAnchor ?? undefined}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 280,
              maxWidth: 360,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
        aria-labelledby="graphic-image-filter-title"
        id="graphic-image-filter-panel"
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography
            id="graphic-image-filter-title"
            variant="subtitle1"
            component="h2"
            fontWeight={600}
          >
            {labels.filters}
          </Typography>
          <IconButton
            size="small"
            onClick={handleClose}
            aria-label="Close filters"
            id="graphic-image-filter-close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Accordion disableGutters square>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">{labels.sortBy}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <RadioGroup
                value={sortBy}
                onChange={(_, value) =>
                  onSortByChange(value as GraphicImageSortBy)
                }
                name="graphic-sort-by"
              >
                <FormControlLabel
                  value="scripture"
                  control={<Radio size="small" />}
                  label={labels.scripture}
                />
                <FormControlLabel
                  value="newest"
                  control={<Radio size="small" />}
                  label={labels.newest}
                />
              </RadioGroup>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters square>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">{labels.styles}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <CheckboxList
                idPrefix="graphic-filter-styles"
                items={styles}
                selectedSet={selectedStylesSet}
                onSelectionChange={onStylesChange}
                showAllOption={true}
                allLabel="All"
              />
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters square>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">{labels.scripture}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {scriptureReference ? (
                <List dense disablePadding>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => {
                        const nextBook = !scriptureRefChecked.book;
                        onScriptureRefCheckedChange({
                          book: nextBook,
                          // When book is unchecked, also uncheck chapter and verse.
                          chapter: nextBook
                            ? scriptureRefChecked.chapter
                            : false,
                          verse: nextBook ? scriptureRefChecked.verse : false,
                        });
                      }}
                      dense
                      id="graphic-filter-ref-book"
                      disabled={refOverride}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={scriptureRefChecked.book}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText primary={scriptureReference.bookName} />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding sx={{ pl: 3 }}>
                    <ListItemButton
                      onClick={() => {
                        const nextChapter = !scriptureRefChecked.chapter;
                        onScriptureRefCheckedChange({
                          // If chapter is checked, ensure book is also checked.
                          book: nextChapter ? true : scriptureRefChecked.book,
                          chapter: nextChapter,
                          // When chapter is unchecked, also uncheck verse.
                          verse: nextChapter
                            ? scriptureRefChecked.verse
                            : false,
                        });
                      }}
                      dense
                      id="graphic-filter-ref-chapter"
                      disabled={refOverride}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={scriptureRefChecked.chapter}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={scriptureReference.chapterNumbers}
                      />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding sx={{ pl: 5 }}>
                    <ListItemButton
                      onClick={() => {
                        const nextVerse = !scriptureRefChecked.verse;
                        onScriptureRefCheckedChange({
                          // If verse is checked, ensure chapter (and book) are also checked.
                          book: nextVerse ? true : scriptureRefChecked.book,
                          chapter: nextVerse
                            ? true
                            : scriptureRefChecked.chapter,
                          verse: nextVerse,
                        });
                      }}
                      dense
                      id="graphic-filter-ref-verse"
                      disabled={refOverride}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={scriptureRefChecked.verse}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText primary={scriptureReference.verseRange} />
                    </ListItemButton>
                  </ListItem>
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No scripture reference
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters square>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">{labels.keywords}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <CheckboxList
                idPrefix="graphic-filter-keywords"
                items={keywords}
                selectedSet={selectedKeywordsSet}
                onSelectionChange={onKeywordsChange}
                showSearch={true}
              />
            </AccordionDetails>
          </Accordion>
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
            px: 2,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <AltButton onClick={handleClear} id="graphic-filter-clear">
            {labels.clear}
          </AltButton>
          <AltButton onClick={handleReset} id="graphic-filter-reset">
            {labels.resetToDefault}
          </AltButton>
        </Box>
      </Popover>
    </>
  );
}

// export {
//   defaultFilterState,
//   defaultScriptureRefChecked,
//   type GraphicImageFilterState,
// };

export default GraphicImageFilter;
