import { MouseEvent, useContext, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IPlanTabsStrings } from '@model/index';
import { Menu, MenuItem } from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Button, Typography, SxProps } from '@mui/material';
import { planTabsSelector } from '../../selector';
import { useOrganizedBy } from '../../crud/useOrganizedBy';
import { useShowAssignment } from '../../crud/useShowAssignment';
import { PlanContext } from '../../context/PlanContext';
import { PlanTabEnum } from '../PlanTabsEnum';
import { UnsavedContext } from '../../context/UnsavedContext';

const ellipsisSx: SxProps = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

interface TabOption {
  label: string;
  tab: PlanTabEnum;
}

export const PlanTabSelect = () => {
  const { checkSavedFn: checkSaved } = useContext(UnsavedContext).state;
  const { flat, tab, setTab } = useContext(PlanContext).state;
  const t: IPlanTabsStrings = useSelector(planTabsSelector, shallowEqual);
  const { getOrganizedBy } = useOrganizedBy();
  const showAssign = useShowAssignment();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const organizedBy = getOrganizedBy(false);
  const sectionLabel = flat
    ? organizedBy
    : t.sectionsPassages.replace('{0}', organizedBy);

  // Build the list of tabs to show in the dropdown menu
  const options: TabOption[] = useMemo(() => {
    const items: TabOption[] = [
      { label: sectionLabel, tab: PlanTabEnum.sectionPassage },
      { label: t.media, tab: PlanTabEnum.media },
    ];
    if (showAssign) {
      items.push({ label: t.assignments, tab: PlanTabEnum.assignment });
      items.push({ label: t.transcriptions, tab: PlanTabEnum.transcription });
    } else {
      items.push({ label: t.transcriptions, tab: PlanTabEnum.assignment });
    }
    return items;
  }, [sectionLabel, t.media, t.assignments, t.transcriptions, showAssign]);

  // Determine which tab is currently selected in the dropdown menu
  const selectedIndex = useMemo(() => {
    const found = options.findIndex(
      (o) => o.tab === (tab ?? PlanTabEnum.sectionPassage)
    );
    return found >= 0 ? found : 0;
  }, [options, tab]);

  const openMenu = (e: MouseEvent<HTMLElement>) =>
    setMenuAnchor(e.currentTarget);
  const closeMenu = () => setMenuAnchor(null);
  const selectTab = (option: TabOption) => {
    setTab(option.tab);
    closeMenu();
  };

  return (
    <>
      <Button
        id="planTabSelect"
        variant="outlined"
        aria-owns={menuAnchor ? 'action-menu' : undefined}
        aria-label={t.sectionsPassages}
        onClick={openMenu}
        endIcon={<DropDownIcon />}
        sx={{ minWidth: 'auto' }}
      >
        <Typography sx={ellipsisSx}>{options[selectedIndex].label}</Typography>
      </Button>
      <Menu
        id="import-export-menu"
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        slotProps={{ paper: { sx: { minWidth: menuAnchor?.offsetWidth } } }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.label}
            id={option.label}
            onClick={() => checkSaved(() => selectTab(option))}
            sx={{ overflow: 'hidden' }}
          >
            <Typography sx={ellipsisSx}>{option.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
