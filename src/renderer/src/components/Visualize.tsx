import { useState, useEffect } from 'react';
import { useGlobal } from '../context/useGlobal';
import {
  Plan,
  Section,
  Role,
  Passage,
  User,
  ISharedStrings,
  IActivityStateStrings,
  localizeActivityState,
  ActivityStates,
  MediaFileD,
  UserD,
} from '../model';
import TreeChart, {
  IPlanRow,
  IWork,
  ITargetWork,
} from '../components/TreeChart';
import { related } from '../crud';
import { useOrbitData } from '../hoc/useOrbitData';
import { shallowEqual, useSelector } from 'react-redux';
import { activitySelector, sharedSelector } from '../selector';

interface IProps {
  selectedPlan?: string;
}

export function Visualize(props: IProps) {
  const { selectedPlan } = props;
  const plans = useOrbitData<Plan[]>('plan');
  const sections = useOrbitData<Section[]>('section');
  const roles = useOrbitData<Role[]>('role');
  const users = useOrbitData<User[]>('user');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const passages = useOrbitData<Passage[]>('passage');
  const [project] = useGlobal('project'); //verified this is not used in a function 2/18/25
  const [rows, setRows] = useState<Array<IPlanRow>>([]);
  const [data1, setData1] = useState<Array<IWork>>([]);
  const [data2, setData2] = useState<Array<IWork>>([]);
  const ta: IActivityStateStrings = useSelector(activitySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  interface ITotal {
    [key: string]: number;
  }

  useEffect(() => {
    const getData = (tot: ITotal) => {
      const results = Array<IWork>();
      const names: string[] = [];
      for (const [key, value] of Object.entries(tot)) {
        const [name, plan, taskType] = key.split(':');
        let task = taskType;
        if (taskType === 'status') {
          if (!names.includes(name as string)) names.push(name as string);
          task = String.fromCharCode(65 + names.findIndex((n) => n === name));
        }
        const item = results.find((i) => i.task === task);
        const work = item ? item.work : Array<ITargetWork>();
        work.push({
          name: name as string,
          plan: plan as string,
          count: value,
        });
        if (!item) results.push({ task: task as string, work });
      }
      return results;
    };

    const rowTot = {} as ITotal;
    const personTot = {} as ITotal;
    const statusTot = {} as ITotal;
    const selPlans = plans.filter(
      (p) =>
        related(p, 'project') === project &&
        (!selectedPlan || p.id === selectedPlan)
    );
    selPlans.forEach((pl) => {
      const planName = pl.attributes.name;
      const selSections = sections.filter((s) => related(s, 'plan') === pl.id);
      const selMedia = mediafiles.filter(
        (m) => related(m, 'plan') === pl.id && Boolean(related(m, 'passage'))
      );
      selSections.forEach((s) => {
        const selPassages = passages.filter(
          (ps) => related(ps, 'section') === s.id
        );
        let roleName = 'transcriber';
        let rowKey = pl.id + ':' + roleName;
        rowTot[rowKey] = Object.prototype.hasOwnProperty.call(rowTot, rowKey)
          ? (rowTot[rowKey] ?? 0) + selPassages.length
          : selPassages.length;

        let userRec = users.filter((u) => u.id === related(s, roleName));
        if (userRec.length > 0) {
          const firstUser = userRec[0] as UserD;
          const userName = firstUser.attributes
            ? firstUser.attributes.name
            : '';
          const personKey = userName + ':' + planName + ':' + roleName;
          personTot[personKey] = Object.prototype.hasOwnProperty.call(
            personTot,
            personKey
          )
            ? (personTot[personKey] ?? 0) + selPassages.length
            : selPassages.length;
        }

        roleName = 'editor';
        rowKey = pl.id + ':' + roleName;
        rowTot[rowKey] = Object.prototype.hasOwnProperty.call(rowTot, rowKey)
          ? (rowTot[rowKey] ?? 0) + selPassages.length
          : selPassages.length;
        userRec = users.filter((u) => u.id === related(s, roleName));
        if (userRec.length > 0) {
          const firstUser = userRec[0] as UserD;
          const userName = firstUser.attributes
            ? firstUser.attributes.name
            : '';
          const personKey = userName + ':' + planName + ':' + roleName;
          personTot[personKey] = Object.prototype.hasOwnProperty.call(
            personTot,
            personKey
          )
            ? (personTot[personKey] ?? 0) + selPassages.length
            : selPassages.length;
        }
      });
      selMedia.forEach((m) => {
        const stateName =
          m.attributes?.transcriptionstate || ActivityStates.TranscribeReady;
        const statusKey =
          localizeActivityState(stateName, ta) + ':' + planName + ':status';
        statusTot[statusKey] = Object.prototype.hasOwnProperty.call(
          statusTot,
          statusKey
        )
          ? (statusTot[statusKey] ?? 0) + 1
          : 1;
      });
    });
    setRows(
      selPlans
        .filter((pl) => {
          const reviewKey = pl.id + ':editor';
          const transKey = pl.id + ':transcriber';
          const reviewTot = Object.prototype.hasOwnProperty.call(
            rowTot,
            reviewKey
          )
            ? rowTot[reviewKey]
            : 0;
          const transTot = Object.prototype.hasOwnProperty.call(
            rowTot,
            transKey
          )
            ? rowTot[transKey]
            : 0;
          return (reviewTot ?? 0) + (transTot ?? 0) > 0;
        })
        .sort((i, j) => (i.attributes.name <= j.attributes.name ? -1 : 1))
        .map((pl) => {
          return {
            plan: pl.attributes.name,
          };
        })
    );
    setData1(getData(personTot));
    setData2(getData(statusTot));
  }, [
    project,
    mediafiles,
    passages,
    plans,
    roles,
    sections,
    users,
    selectedPlan,
    ta,
    ts,
  ]);

  return <TreeChart rows={rows} data1={data1} data2={data2} />;
}

export default Visualize;
