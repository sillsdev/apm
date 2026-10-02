import { shallowEqual, useSelector } from 'react-redux';
import { workflowStepsSelector } from '../selector';
import { addPt } from './addPt';
import { toCamel } from './toCamel';
import { IWorkflowStepsStrings } from '../model';

export const useWfLabel = () => {
  const t: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );

  return (label: string) => {
    const camelLabel = toCamel(label);
    return Object.prototype.hasOwnProperty.call(t, camelLabel)
      ? addPt(t.getString(camelLabel))
      : label;
  };
};
