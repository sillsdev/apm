import { useState, useEffect, useMemo } from 'react';
import { useGlobal } from '../../context/useGlobal';
import {
  MediaFile,
  MediaFileD,
  Passage,
  Section,
  Plan,
  BookName,
  IState,
  ProjectD,
  SectionArray,
} from '../../model';
import {
  findRecord,
  related,
  useArtifactType,
  usePlan,
  useRole,
} from '../../crud';
import { IRow, IGetMedia } from '.';
import { getMedia } from './getMedia';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useSelector } from 'react-redux';
import {
  projDefSectionMap,
  useProjectDefaults,
} from '../../crud/useProjectDefaults';

/**
 * Count of vernacular media files for a passage (same filter as VersionDlg rows).
 */
export function usePassageVernacularVersionCount(passId: string): number {
  const mediaFiles = useOrbitData<MediaFileD[]>('mediafile');
  const { IsVernacularMedia } = useArtifactType();
  return useMemo(
    () =>
      mediaFiles.filter(
        (m) => related(m, 'passage') === passId && IsVernacularMedia(m)
      ).length,
    [mediaFiles, passId, IsVernacularMedia]
  );
}

/**
 * Shared data for passage vernacular version lists (VersionDlg).
 */
export function usePassageVersionAudioRows(passId: string, playItem: string) {
  const mediaFiles = useOrbitData<MediaFileD[]>('mediafile');
  const sections = useOrbitData<Section[]>('section');
  const passages = useOrbitData<Passage[]>('passage');
  const [plan] = useGlobal('plan');
  const [project] = useGlobal('project');
  const [memory] = useGlobal('memory');
  const { getPlan } = usePlan();
  const [planRec] = useState(getPlan(plan) || ({} as Plan));
  const [data, setData] = useState<IRow[]>([]);
  const [sectionArr, setSectionArr] = useState<SectionArray>([]);
  const [sectionMap, setSectionMap] = useState(new Map<number, string>());
  const [shared, setShared] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const handleRefresh = () => setRefresh((r) => r + 1);
  const { IsVernacularMedia } = useArtifactType();
  const allBookData: BookName[] = useSelector(
    (state: IState) => state.books.bookData
  );
  const { getProjectDefault } = useProjectDefaults();
  const { userIsAdmin } = useRole();
  const [offline] = useGlobal('offline');
  const [offlineOnly] = useGlobal('offlineOnly');
  const [readonly] = useState((offline && !offlineOnly) || !userIsAdmin);

  useEffect(() => {
    const projRec = findRecord(memory, 'project', project) as ProjectD;
    let projSectionArr: undefined | SectionArray = [];
    if (projRec) {
      setShared(projRec?.attributes?.isPublic || false);
      projSectionArr = getProjectDefault(projDefSectionMap, projRec) as
        | SectionArray
        | undefined;
    }
    setSectionArr(projSectionArr || []);
    setSectionMap(new Map(projSectionArr || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    const playChange = data.length > 0 && data[0]?.playIcon !== playItem;
    const media: MediaFile[] = mediaFiles.filter(
      (m) => related(m, 'passage') === passId && IsVernacularMedia(m)
    );
    const mediaData: IGetMedia = {
      planName: planRec?.attributes?.name,
      passages,
      sections,
      playItem,
      allBookData,
      sectionMap,
      isPassageDate: false,
    };
    const newData = getMedia(media, mediaData);
    if (newData.length !== data.length || playChange || refresh) {
      setData(newData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mediaFiles,
    sections,
    passages,
    planRec,
    passId,
    playItem,
    refresh,
    sectionMap,
  ]);

  return { data, sectionArr, shared, readonly, handleRefresh };
}
