import { useContext, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IPlanTabsStrings } from '@model/index';
import { Menu, MenuItem } from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import { planTabsSelector } from '../../selector';
import { useShowAssignment } from '../../crud/useShowAssignment';
import { useMobile } from '../../utils';
import { PlanContext } from '../../context/PlanContext';
import { PlanTabEnum } from '../PlanTabsEnum';
import { UnsavedContext } from '../../context/UnsavedContext';
import { Button } from '../../control/Button';

export const PlanTabSelect = () => {
  const { checkSavedFn: checkSaved } = useContext(UnsavedContext).state;
  const [actionMenuItem, setActionMenuItem] = useState<null | HTMLElement>(
    null
  );
  const t: IPlanTabsStrings = useSelector(planTabsSelector, shallowEqual);
  const ctx = useContext(PlanContext);
  const { tab, setTab } = ctx.state;
  const showAssign = useShowAssignment();
  const { isMobile } = useMobile();

  const options = useMemo(() => {
    const sectionPassage = {
      label: 'Project Overview',
      tab: PlanTabEnum.sectionPassage,
    };
    const assignments = { label: t.assignments, tab: PlanTabEnum.assignment };
    if (isMobile)
      return showAssign ? [sectionPassage, assignments] : [sectionPassage];
    const base = [sectionPassage, { label: t.media, tab: PlanTabEnum.media }];
    return showAssign
      ? [
          ...base,
          assignments,
          { label: t.transcriptions, tab: PlanTabEnum.transcription },
        ]
      : [...base, { label: t.transcriptions, tab: PlanTabEnum.assignment }];
  }, [t.media, t.assignments, t.transcriptions, showAssign, isMobile]);
  const handleMenu = (e: any) => setActionMenuItem(e.currentTarget);
  const handleClose = () => setActionMenuItem(null);
  const handleChange = (tabIndex: PlanTabEnum) => {
    setTab(tabIndex);
    handleClose();
  };

  const resolvedTab = tab ?? 0;
  const selected = options.find((o) => o.tab === resolvedTab);

  return (
    <>
      <Button
        id="planTabSelect"
        aria-owns={actionMenuItem ? 'action-menu' : undefined}
        aria-label="Project Overview"
        variant="outlined"
        onClick={handleMenu}
        endIcon={<DropDownIcon />}
      >
        {(selected ?? options[0]).label}
      </Button>
      <Menu
        id="import-export-menu"
        anchorEl={actionMenuItem}
        open={Boolean(actionMenuItem)}
        onClose={handleClose}
      >
        {options.map((o) => (
          <MenuItem
            key={o.label}
            id={o.label}
            onClick={() => checkSaved(() => handleChange(o.tab))}
          >
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
