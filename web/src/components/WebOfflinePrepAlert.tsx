import { useEffect, useState } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useOfflnProjRead } from '../crud/useOfflnProjRead';
import ProjectDownloadAlert from './ProjectDownloadAlert';

/**
 * Web offline prep (ADR 0017): when the open project has offline intent
 * (Offline Available), offer to download what this device is missing into
 * Local Media Blobs. Opens on project open and when the intent is switched
 * on. Without offline intent, media is stored lazily as it is played.
 */
export function WebOfflinePrepAlert() {
  const [project] = useGlobal('project');
  const getOfflineProject = useOfflnProjRead();
  const offlineIntent = Boolean(
    project && getOfflineProject(project)?.attributes?.offlineAvailable
  );
  const [open, setOpen] = useState(false);

  // Re-offer only when the project or its intent changes, so new media from
  // sync doesn't reopen a dialog the user closed ("download later").
  useEffect(() => {
    setOpen(offlineIntent);
  }, [project, offlineIntent]);

  if (!open) return null;
  return (
    <ProjectDownloadAlert
      key={project}
      projectId={project}
      cb={() => setOpen(false)}
    />
  );
}

export default WebOfflinePrepAlert;
