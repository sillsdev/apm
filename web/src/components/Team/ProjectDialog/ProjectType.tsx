import React from 'react';
import { TeamContext } from '../../../context/TeamContext';
import { Options } from '.';
import { shallowEqual, useSelector } from 'react-redux';
import { vProjectSelector } from '../../../selector';
import { IVProjectStrings } from '../../../model';
import { BOLD_WORKFLOW_PROCESS, useTeamWorkflowProcess } from '../../../crud';

interface IProps {
  type: string;
  onChange: (type: string) => void;
  team?: string;
}

export const ProjectType = (props: IProps) => {
  const { type, onChange, team } = props;
  const ctx = React.useContext(TeamContext);
  const { planTypes } = ctx.state;
  const t: IVProjectStrings = useSelector(vProjectSelector, shallowEqual);
  const teamWorkflow = useTeamWorkflowProcess(team);

  return (
    <Options
      label={t.type}
      defaultValue={type}
      options={planTypes
        .filter((pt) =>
          teamWorkflow === BOLD_WORKFLOW_PROCESS
            ? pt.attributes.name.toLowerCase() === 'other'
            : true
        )
        .sort((i, j) => (i.attributes.name <= j.attributes.name ? -1 : 1))
        .map((pt) => pt.attributes.name.toLowerCase())}
      onChange={onChange}
      pt={1}
    />
  );
};
