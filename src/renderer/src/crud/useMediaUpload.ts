import { useRef, useContext, useEffect } from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import {
  pullTableList,
  related,
  remoteIdNum,
  useArtifactType,
  useOfflnMediafileCreate,
} from '.';
import * as actions from '../store';
import JSONAPISource from '@orbit/jsonapi';
import { TokenContext } from '../context/TokenProvider';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { IndexedDBSource } from '@orbit/indexeddb';
import { UploadType } from '../components/UploadType';
import { RecordKeyMap } from '@orbit/records';
import { getContentType } from '../utils/contentType';
import { ISharedStrings, MediaFileAttributes, MediaFileD } from '../model';
import { AlertSeverity, useSnackBar } from '../hoc/SnackBar';
import { mediaTabSelector, sharedSelector } from '../selector';
import { OrbitNetworkErrorRetries } from '../../api-variable';
import { formatUploadTerminalFailureMessage } from '../store/upload/uploadTerminalMessages';
import { suggestsConnectionProblem } from '../store/upload/uploadRetry';

interface IProps {
  artifactId: string | null;
  passageId: string | undefined;
  planId?: string | undefined;
  sourceMediaId?: string | undefined;
  sourceSegments?: string | undefined;
  performedBy?: string | undefined;
  topic?: string | undefined;
  /** Copied onto mediafile.attributes.languagebcp47 (e.g. `English|en`). */
  languagebcp47?: string | undefined;
  afterUploadCb: (mediaId: string) => Promise<void>;
  /** When retrying a queued failed upload, pass id to clear the queue entry after success. */
  pendingUploadIdToClearOnSuccess?: string;
}
export const useMediaUpload = ({
  artifactId,
  passageId,
  sourceMediaId,
  sourceSegments,
  performedBy,
  planId,
  topic,
  languagebcp47,
  afterUploadCb,
  pendingUploadIdToClearOnSuccess,
}: IProps) => {
  const dispatch = useDispatch();
  const uploadFiles = (files: File[]) =>
    dispatch(actions.uploadFiles(files) as any);
  const nextUpload = (props: actions.NextUploadProps) =>
    dispatch(actions.nextUpload(props) as any);
  const { showMessage } = useSnackBar();
  const [reporter] = useGlobal('errorReporter');
  const [memory] = useGlobal('memory');
  const [coordinator] = useGlobal('coordinator');
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const getGlobal = useGetGlobal();
  const [user] = useGlobal('user');
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? null;
  const fileList = useRef<File[] | undefined>(undefined);
  const mediaIdRef = useRef('');
  // TT-6646: MediaRecord's save effect omits performedBy/topic from deps, so
  // a stale uploadMedia closure can run after the user typed speaker/topic.
  // Keep latest values in refs (updated in an effect — not during render).
  const performedByRef = useRef(performedBy);
  const topicRef = useRef(topic);
  useEffect(() => {
    performedByRef.current = performedBy;
    topicRef.current = topic;
  }, [performedBy, topic]);
  const { createMedia } = useOfflnMediafileCreate();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t = useSelector(mediaTabSelector, shallowEqual);
  const { localizedArtifactTypeFromId } = useArtifactType();
  const [, setOrbitRetries] = useGlobal('orbitRetries'); //verified this is not used in a function 2/18/25
  const getLatestVersion = () => {
    let num = 1;
    const psgId = passageId || '';
    if (psgId && !artifactId) {
      const mediaFiles = (
        memory.cache.query((q) => q.findRecords('mediafile')) as MediaFileD[]
      )
        .filter(
          (m) =>
            related(m, 'passage') === psgId &&
            related(m, 'artifactType') === null
        )
        .filter((m) => m?.attributes?.versionNumber !== undefined)
        .sort(
          (i, j) => j.attributes.versionNumber - i.attributes.versionNumber
        );
      if (mediaFiles.length > 0) {
        //vernacular
        num = (mediaFiles[0] as MediaFileD).attributes.versionNumber + 1;
      }
    }
    return num;
  };
  const itemComplete = async (
    n: number,
    success: boolean,
    data?: any,
    failure?: actions.UploadFailureInfo
  ): Promise<void> => {
    if (!success && suggestsConnectionProblem(failure))
      setOrbitRetries(OrbitNetworkErrorRetries - 1); //notify of possible network issue
    const uploadList = fileList.current;
    if (!uploadList) return; // This should never happen
    if (data?.stringId) {
      mediaIdRef.current = data?.stringId;
    } else if (success && data) {
      // offlineOnly
      const num = getLatestVersion();
      mediaIdRef.current = (
        await createMedia(
          data,
          num,
          (uploadList[n] as File).size,
          passageId ?? '',
          artifactId,
          sourceMediaId ?? '',
          user
        )
      ).id;
    } else mediaIdRef.current = '';
    const finishUpload = async () => {
      dispatch(actions.uploadComplete() as any);
      const total = fileList.current?.length ?? 1;
      const ok = mediaIdRef.current ? 1 : 0;
      showMessage(
        t.uploadComplete
          .replace('{0}', String(ok))
          .replace('{1}', String(total))
      );
      try {
        await afterUploadCb(mediaIdRef.current);
      } catch {
        // Parent after-upload hook failed; upload itself is finished.
      }
    };
    if (!getGlobal('offline') && mediaIdRef.current) {
      try {
        await pullTableList(
          'mediafile',
          Array(mediaIdRef.current),
          memory,
          remote,
          backup,
          reporter
        );
      } catch {
        // Sync failure still runs upload cleanup.
      }
    }
    await finishUpload();
  };

  return (files: File[]): Promise<boolean> => {
    if (!files.length) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      const getPlanId = () =>
        planId
          ? remoteIdNum('plan', planId, memory?.keyMap as RecordKeyMap) ||
            planId
          : remoteIdNum(
              'plan',
              getGlobal('plan'),
              memory?.keyMap as RecordKeyMap
            ) || getGlobal('plan');
      const getArtifactId = () =>
        artifactId === null
          ? null
          : remoteIdNum(
              'artifacttype',
              artifactId,
              memory?.keyMap as RecordKeyMap
            ) || artifactId;
      const getPassageId = () =>
        passageId
          ? remoteIdNum('passage', passageId, memory?.keyMap as RecordKeyMap) ||
            passageId
          : '';
      const getUserId = () =>
        remoteIdNum('user', user, memory?.keyMap as RecordKeyMap) || user;
      const getSourceMediaId = () =>
        remoteIdNum(
          'mediafile',
          sourceMediaId || '',
          memory?.keyMap as RecordKeyMap
        ) || sourceMediaId;

      uploadFiles(files);
      fileList.current = files;

      const mediafile = {
        planId: getPlanId(),
        versionNumber: 1,
        originalFile: (files[0] as File).name,
        contentType: getContentType(files[0]?.type, (files[0] as File).name),
        artifactTypeId: getArtifactId(),
        passageId: getPassageId(),
        recordedbyUserId: getUserId(),
        userId: getUserId(),
        sourceMediaId: getSourceMediaId(),
        sourceSegments: sourceSegments ?? '{}',
        performedBy: performedByRef.current ?? null,
        topic: topicRef.current ?? '',
        languagebcp47: languagebcp47 ?? '',
        eafUrl: !artifactId
          ? ts.mediaAttached
          : localizedArtifactTypeFromId(artifactId), //put psc message here
      } as MediaFileAttributes & {
        planId: string;
        artifactTypeId: string;
        passageId: string;
        recordedbyUserId: string;
        userId: string;
        sourceMediaId: string;
      };
      nextUpload({
        record: mediafile,
        files,
        n: 0,
        token: accessToken || '',
        offline: getGlobal('offline'),
        errorReporter: reporter,
        uploadType: UploadType.Media,
        cb: (n, success, data, failure) => {
          void itemComplete(n, success, data, failure)
            .then(() => {
              if (success) resolve(true);
              else reject(new Error(t.uploadFailed));
            })
            .catch(reject);
        },
        pendingUploadIdToClearOnSuccess,
        onTerminalFailure: (info) => {
          showMessage(
            formatUploadTerminalFailureMessage(t, info),
            AlertSeverity.Warning
          );
        },
      });
    });
  };
};
