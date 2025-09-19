import { useLocation, useParams } from 'react-router-dom';
import React from 'react';
import StickyRedirect from '../components/StickyRedirect';
import { BurritoOption } from '../burrito/BurritoOption';
import { pad2 } from '../utils';
import { useOrgDefaults } from '../crud/useOrgDefaults';
import { BurritoHeader } from '../components/BurritoHeader';
import { BurritoType } from '../burrito/BurritoType';

export const burritoContents = 'burritoContents';

const contents = Object.values(BurritoType);

export function BurritoContents() {
  const { pathname } = useLocation();
  const { teamId } = useParams();
  const [view, setView] = React.useState('');
  const [checked, setChecked] = React.useState<string[]>([]);
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();

  const handleSave = () => {
    setOrgDefault(burritoContents, checked, teamId);
    setView(`/burrito/${teamId}`);
  };

  React.useEffect(() => {
    if (teamId) {
      if (teamId) {
        const curContents = getOrgDefault(burritoContents, teamId) as
          | string[]
          | undefined;
        if (Array.isArray(curContents)) {
          setChecked(curContents);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (view !== '' && view !== pathname) {
    return <StickyRedirect to={view} />;
  }

  return (
    <BurritoHeader
      burritoType={'Contents'}
      setView={setView}
      teamId={teamId}
      onSave={handleSave}
      saveDisabled={checked.length === 0}
    >
      <BurritoOption
        options={contents.map((content, index) => ({
          label: `${pad2(index + 1)} - ${content}`,
          value: content,
        }))}
        value={checked}
        onChange={(value) => setChecked(value)}
      />
    </BurritoHeader>
  );
}
