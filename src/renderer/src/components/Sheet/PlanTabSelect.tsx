import { useContext, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IPlanTabsStrings } from '@model/index';
import { Button, Menu, MenuItem } from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import { planTabsSelector } from '../../selector';
import { useOrganizedBy } from '../../crud/useOrganizedBy';
import { useShowAssignment } from '../../crud/useShowAssignment';
import { PlanContext } from '../../context/PlanContext';
import { PlanTabEnum } from '../PlanTabsEnum';
import { UnsavedContext } from '../../context/UnsavedContext';

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
  const defaultItem = useMemo(
    () => (flat ? organizedBy : t.sectionsPassages.replace('{0}', organizedBy)),
    [flat, organizedBy, t]
  );
  const options = useMemo(() => {
    const base = [defaultItem, t.media];
    return showAssign
      ? [...base, t.assignments, t.transcriptions]
      : [...base, t.transcriptions];
  }, [defaultItem, t.media, t.assignments, t.transcriptions, showAssign]);
  const handleMenu = (e: any) => setActionMenuItem(e.currentTarget);
  const handleClose = () => setActionMenuItem(null);
  const handleChange = (menuIndex: number) => {
    const tabIndex =
      showAssign || menuIndex < PlanTabEnum.assignment
        ? menuIndex
        : PlanTabEnum.assignment;
    setTab(tabIndex);
    handleClose();
  };

  const resolvedTab = tab ?? 0;
  const optionIndex =
    !showAssign && resolvedTab === PlanTabEnum.transcription
      ? PlanTabEnum.assignment
      : resolvedTab;

  return (
    <>
      <Button
        id="planTabSelect"
        aria-owns={actionMenuItem ? 'action-menu' : undefined}
        aria-label={t.sectionsPassages}
        variant="outlined"
        onClick={handleMenu}
        endIcon={<DropDownIcon />}
      >
        {options[optionIndex] ?? options[0]}
      </Button>
      <Menu
        id="import-export-menu"
        anchorEl={actionMenuItem}
        open={Boolean(actionMenuItem)}
        onClose={handleClose}
      >
        {options.map((v, i) => (
          <MenuItem
            key={v}
            id={v}
            onClick={() => checkSaved(() => handleChange(i))}
          >
            {v}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
