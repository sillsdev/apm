import { useContext, useEffect, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IPlanTabsStrings } from '@model/index';
import { Menu, MenuItem } from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import { AltButton } from '../../control/AltButton';
import { planTabsSelector } from '../../selector';
import { useOrganizedBy } from '../../crud/useOrganizedBy';
import { PlanContext } from '../../context/PlanContext';

export const PlanTabSelect = () => {
  const [actionMenuItem, setActionMenuItem] = useState<null | HTMLElement>(
    null
  );
  const t: IPlanTabsStrings = useSelector(planTabsSelector, shallowEqual);
  const { getOrganizedBy } = useOrganizedBy();
  const organizedBy = getOrganizedBy(false);
  const ctx = useContext(PlanContext);
  const { flat, tab, setTab } = ctx.state;
  const defaultItem = useMemo(
    () => (flat ? organizedBy : t.sectionsPassages.replace('{0}', organizedBy)),
    [flat, organizedBy, t]
  );
  const [options, setOptions] = useState<string[]>([]);
  const handleMenu = (e: any) => setActionMenuItem(e.currentTarget);
  const handleClose = () => setActionMenuItem(null);
  const handleChange = (i: number) => () => {
    setTab(i);
    handleClose();
  };

  useEffect(() => {
    setOptions([defaultItem, t.media, t.assignments, t.transcriptions]);
  }, [defaultItem, t.media, t.assignments, t.transcriptions]);

  return (
    <>
      <AltButton
        id="planTabSelect"
        aria-owns={actionMenuItem ? 'action-menu' : undefined}
        aria-label={t.sectionsPassages}
        onClick={handleMenu}
      >
        {options[tab]}
        <DropDownIcon sx={{ ml: 1 }} />
      </AltButton>
      <Menu
        id="import-export-menu"
        anchorEl={actionMenuItem}
        open={Boolean(actionMenuItem)}
        onClose={handleClose}
      >
        {options.map((v, i) => (
          <MenuItem key={v} id={v} onClick={handleChange(i)}>
            {v}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
