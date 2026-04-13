import { useContext, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IPlanTabsStrings, OrganizationD } from '@model/index';
import { Menu, MenuItem } from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import { AltButton } from '../../control/AltButton';
import { planTabsSelector } from '../../selector';
import { useOrganizedBy } from '../../crud/useOrganizedBy';
import { isPersonalTeam } from '../../crud/isPersonalTeam';
import { PlanContext } from '../../context/PlanContext';
import { useGlobal } from '../../context/useGlobal';
import { useOrbitData } from '../../hoc/useOrbitData';
import { PlanTabEnum } from '../PlanTabsEnum';

export const PlanTabSelect = () => {
  const [actionMenuItem, setActionMenuItem] = useState<null | HTMLElement>(
    null
  );
  const t: IPlanTabsStrings = useSelector(planTabsSelector, shallowEqual);
  const { getOrganizedBy } = useOrganizedBy();
  const organizedBy = getOrganizedBy(false);
  const ctx = useContext(PlanContext);
  const { flat, tab, setTab } = ctx.state;
  const [team] = useGlobal('organization');
  const [offlineOnly] = useGlobal('offlineOnly');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const showAssign = useMemo(
    () => !isPersonalTeam(team, teams) && !offlineOnly,
    [team, teams, offlineOnly]
  );
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
  const handleChange = (menuIndex: number) => () => {
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
      <AltButton
        id="planTabSelect"
        aria-owns={actionMenuItem ? 'action-menu' : undefined}
        aria-label={t.sectionsPassages}
        onClick={handleMenu}
      >
        {options[optionIndex] ?? options[0]}
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
