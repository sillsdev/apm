import { useCallback, useMemo, useState } from 'react';
import { useOrgDefaults } from '../../../../crud/useOrgDefaults';
import type { IRegionParams } from '../../../../crud/useWavesurferRegions';
import { NamedRegions } from '../../../../utils/namedSegments';

const defaultSegParams: IRegionParams = {
  silenceThreshold: 0.004,
  timeThreshold: 0.02,
  segLenThreshold: 0.5,
};

/**
 * Segment settings for mobile transcription: the team's saved settings, which
 * a local edit (not saved as the team default) overrides until the team
 * settings themselves change.
 */
export function useTeamSegParams() {
  const { getOrgDefault } = useOrgDefaults();
  // The team settings as a value: getOrgDefault is recreated every render and
  // parses a fresh object, so neither can be compared from render to render.
  const teamSegParams = JSON.stringify(
    getOrgDefault(NamedRegions.Transcription) ?? null
  );
  const teamParams = useMemo(
    () => JSON.parse(teamSegParams) as IRegionParams | null,
    [teamSegParams]
  );
  // A local edit remembers the team settings it was made against, and only
  // applies while those are still the team settings.
  const [localEdit, setLocalEdit] = useState<{
    forTeam: string;
    params: IRegionParams;
  }>();
  const segParams =
    localEdit && localEdit.forTeam === teamSegParams
      ? localEdit.params
      : (teamParams ?? defaultSegParams);
  const setSegParams = useCallback(
    (params: IRegionParams) => setLocalEdit({ forTeam: teamSegParams, params }),
    [teamSegParams]
  );
  return [segParams, setSegParams] as const;
}
