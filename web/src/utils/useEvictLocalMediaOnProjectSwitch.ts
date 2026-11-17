/**
 * Web-only: after the global project id changes to a different non-empty
 * project, evict the previous project's Cloud-backed Local Media Blobs
 * (ADR 0017). Upload Pending is never touched here.
 */

import { useEffect, useRef } from 'react';
import { isElectron } from '../../api-variable';
import { useGlobal } from '../context/useGlobal';
import bugsnagClient from '../auth/bugsnagClient';
import { logError, Severity } from './logErrorService';
import { evictLocalMediaForProjectSwitch } from './evictLocalMediaBlobs';

export const useEvictLocalMediaOnProjectSwitch = (): void => {
  const [project] = useGlobal('project');
  const previousProjectId = useRef(project);

  useEffect(() => {
    if (isElectron) return;
    const previous = previousProjectId.current;
    previousProjectId.current = project;
    // Evict only after a successful switch onto another project — not on
    // first load (previous empty) or when clearing project (going home).
    if (!previous || !project || previous === project) return;
    void evictLocalMediaForProjectSwitch(previous).catch((err: unknown) => {
      logError(
        Severity.error,
        bugsnagClient,
        `evictLocalMediaForProjectSwitch(${previous}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });
  }, [project]);
};
