import { useMemo } from 'react';
import { MediaFile, UserD } from '../../../model';
import { related } from '../../../crud/related';
import { useOrbitData } from '../../../hoc/useOrbitData';

/** Display name of the user who last changed the transcription (confirm dialog). */
export function useOtherEditorName(
  mediafile: MediaFile | undefined,
  confirmOpen: boolean,
  unknownUser: string
) {
  const users = useOrbitData<UserD[]>('user');
  return useMemo(() => {
    if (!confirmOpen || !mediafile) return unknownUser;
    const userId = related(mediafile, 'lastModifiedByUser');
    return users.find((u) => u.id === userId)?.attributes?.name ?? unknownUser;
  }, [confirmOpen, mediafile, users, unknownUser]);
}
