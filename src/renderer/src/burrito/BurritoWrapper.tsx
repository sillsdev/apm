import { useLocation, useParams } from 'react-router-dom';
import React from 'react';
import StickyRedirect from '../components/StickyRedirect';
import { useOrgDefaults } from '../crud/useOrgDefaults';
import { BurritoHeader } from '../components/BurritoHeader';
import { MetadataView } from './MetadataView';
import type { BurritoWrapper as BurritoWrapperType } from './data/wrapperBuilder';
import { wrapperBuilder } from './data/wrapperBuilder';
import { useOrbitData } from '../hoc/useOrbitData';
import {
  BibleD,
  IBurritoStrings,
  ISharedStrings,
  OrganizationBibleD,
  OrganizationD,
  UserD,
} from '../model';
import related from '../crud/related';
import { burritoContents } from './BurritoContents';
import { BurritoType } from './BurritoType';
import { Burrito } from './data/wrapperBuilder';
import { AltButton } from '../control/AltButton';
import packageJson from '../../package.json';
import { toCamel } from '../utils';
import { shallowEqual, useSelector } from 'react-redux';
import { burritoSelector, sharedSelector } from '../selector';
const version = packageJson.version;
const productName = packageJson.build.productName;

export const burritoWrapper = 'burritoWrapper';

export function BurritoWrapper() {
  const { pathname } = useLocation();
  const { teamId } = useParams();
  const users = useOrbitData<UserD[]>('user');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const teamBibles = useOrbitData<OrganizationBibleD[]>('organizationbible');
  const bibles = useOrbitData<BibleD[]>('bible');
  const [view, setView] = React.useState('');
  const [refresh, setRefresh] = React.useState(0);
  const [metaData, setMetaData] = React.useState<BurritoWrapperType>();
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  const t: IBurritoStrings = useSelector(burritoSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const handleSave = () => {
    setOrgDefault(burritoWrapper, metaData, teamId);
    setView(`/burrito/${teamId}`);
  };

  const handleRefresh = () => {
    setRefresh((prev) => prev + 1);
    setView('');
    setMetaData(undefined);
    setOrgDefault(burritoWrapper, undefined, teamId);
  };

  // NOTE: these are part of the spec so don't get translated
  const burritoRole = (type: BurritoType) =>
    type === BurritoType.Audio
      ? 'source'
      : [BurritoType.Text /* BurritoType.BackTranslation */].includes(type)
        ? 'derived'
        : 'supplemental';

  React.useEffect(() => {
    if (teamId) {
      if (teamId) {
        const curContents = getOrgDefault(burritoWrapper, teamId) as
          | BurritoWrapperType
          | undefined;
        if (curContents) {
          setMetaData(curContents);
        } else if (users && teams && teamBibles && bibles) {
          const team = teams.find((t) => t.id === teamId);
          if (team) {
            // get Bible Info
            const teamBibleRec = teamBibles.find(
              (t) => related(t, 'organization') === teamId
            );
            const bibleId = related(teamBibleRec, 'bible');
            const bible = bibles.find((b) => b.id === bibleId);
            const abbreviation =
              bible?.attributes?.bibleId || `${bible?.attributes?.iso}New`;

            const curContents = getOrgDefault(burritoContents, teamId) as
              | string[]
              | undefined;
            const burritos =
              curContents?.map(
                (c: string) =>
                  ({
                    id: `${abbreviation}-${toCamel(c)}`,
                    path: toCamel(c).toLocaleLowerCase(),
                    role: burritoRole(c as BurritoType),
                  }) as Burrito
              ) || [];

            setMetaData(
              wrapperBuilder({
                genName: productName,
                genVersion: version,
                name: `${
                  bible?.attributes?.bibleName || team?.attributes?.name
                } Burrito Wrapper`,
                abbreviation,
                description: `A new burrito wrapper for ${team?.attributes?.name}`,
                comments: '',
                burritos,
                alignments: [],
              })
            );
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, teams, users, teamBibles, bibles, refresh]);

  if (view !== '' && view !== pathname) {
    return <StickyRedirect to={view} />;
  }

  return (
    <BurritoHeader
      burritoType={t.wrapper}
      setView={setView}
      teamId={teamId}
      onSave={handleSave}
      saveDisabled={!metaData}
      action={
        <AltButton onClick={handleRefresh} disabled={!metaData}>
          Refresh
        </AltButton>
      }
    >
      {metaData ? <MetadataView wrapper={metaData} /> : ts.loading}
    </BurritoHeader>
  );
}
