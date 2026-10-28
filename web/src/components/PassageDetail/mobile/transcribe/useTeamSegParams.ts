import { useEffect, useState } from 'react';
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
  const [segParams, setSegParams] = useState<IRegionParams>(defaultSegParams);
  // The team settings as a value: getOrgDefault is recreated every render and
  // parses a fresh object, so neither can key the effect.
  const teamSegParams = JSON.stringify(
    getOrgDefault(NamedRegions.Transcription) ?? null
  );
  useEffect(() => {
    const params = JSON.parse(teamSegParams) as IRegionParams | null;
    if (params) setSegParams(params);
  }, [teamSegParams]);
  return [segParams, setSegParams] as const;
}
