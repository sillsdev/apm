import { MouseEventHandler, useContext } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Box, IconButton } from '@mui/material';
import PublishOnIcon from '@mui/icons-material/PublicOutlined';
import PublishOffIcon from '@mui/icons-material/PublicOffOutlined';
import { IPlanSheetStrings, ISheet, OrgWorkflowStep } from '@model/index';
import { useGlobal } from '../../context/useGlobal';
import { PlanContext } from '../../context/PlanContext';
import { planSheetSelector } from '../../selector';
import { LightTooltip } from '../../control/LightTooltip';
import { spreadSx, rowSx, rigidSx } from '../../control';
import FilterMenu, { ISTFilterState } from './filterMenu';
import { PlanTabSelect } from './PlanTabSelect';

interface IProps {
  publishingOn: boolean;
  hidePublishing: boolean;
  handlePublishToggle: MouseEventHandler<HTMLButtonElement>;
  data: any[];
  canSetDefault: boolean;
  filterState: ISTFilterState;
  onFilterChange: (
    newstate: ISTFilterState | undefined | null,
    isDefault: boolean
  ) => void;
  orgSteps: OrgWorkflowStep[];
  minimumSection: number;
  maximumSection: number;
  filtered: boolean;
  rowInfo: ISheet[];
}

export const PlanBar = (props: IProps) => {
  const {
    publishingOn,
    hidePublishing,
    handlePublishToggle,
    data,
    canSetDefault,
    filterState,
    onFilterChange,
    orgSteps,
    minimumSection,
    maximumSection,
    filtered,
    rowInfo,
  } = props;
  const ctx = useContext(PlanContext);
  const { flat } = ctx.state;
  const [offline] = useGlobal('offline');
  const t: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);

  return (
    <Box sx={spreadSx}>
      <PlanTabSelect />
      <Box sx={[rowSx, rigidSx]}>
        {data.length > 1 && !offline && !flat && (
          <LightTooltip
            title={
              !publishingOn || hidePublishing
                ? t.showPublishing
                : t.hidePublishing
            }
          >
            <IconButton onClick={handlePublishToggle}>
              {!publishingOn || hidePublishing ? (
                <PublishOnIcon sx={{ color: 'primary.light' }} />
              ) : (
                <PublishOffIcon sx={{ color: 'primary.light' }} />
              )}
            </IconButton>
          </LightTooltip>
        )}
        <FilterMenu
          canSetDefault={canSetDefault}
          state={filterState}
          onFilterChange={onFilterChange}
          orgSteps={orgSteps}
          minimumSection={minimumSection}
          maximumSection={maximumSection}
          filtered={filtered}
          hidePublishing={hidePublishing}
          disabled={!filtered && rowInfo.length < 2}
        />
      </Box>
    </Box>
  );
};
