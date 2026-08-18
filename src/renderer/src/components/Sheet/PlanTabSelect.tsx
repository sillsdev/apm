import { useContext, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Menu, MenuItem } from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import { IPlanTabsStrings } from '@model/index';
import { planTabsSelector } from '../../selector';
import { PlanContext } from '../../context/PlanContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useOrganizedBy } from '../../crud/useOrganizedBy';
import { useShowAssignment } from '../../crud/useShowAssignment';
import { useMobile } from '../../utils';
import { Button } from '../../control';
import { PlanTabEnum } from '../PlanTabsEnum';

export const PlanTabSelect = () => {
  const { checkSavedFn: checkSaved } = useContext(UnsavedContext).state;
  const [actionMenuItem, setActionMenuItem] = useState<null | HTMLElement>(
    null
  );
  const t: IPlanTabsStrings = useSelector(planTabsSelector, shallowEqual);
  const { getOrganizedBy } = useOrganizedBy();
  const organizedBy = getOrganizedBy(false);
  const ctx = useContext(PlanContext);
  const { flat, tab, setTab } = ctx.state;
  const showAssign = useShowAssignment();
  const { isMobile } = useMobile();
  const defaultItem = useMemo(
    () => (flat ? organizedBy : t.sectionsPassages.replace('{0}', organizedBy)),
    [flat, organizedBy, t]
  );

  const options = useMemo(() => {
    const sectionPassage = {
      label: defaultItem,
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
  }, [
    defaultItem,
    t.media,
    t.assignments,
    t.transcriptions,
    showAssign,
    isMobile,
  ]);
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
        aria-label={t.sectionsPassages}
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
