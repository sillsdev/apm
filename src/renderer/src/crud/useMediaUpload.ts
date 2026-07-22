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
import {
  ArtifactTypeD,
  ISharedStrings,
  MediaFileAttributes,
  MediaFileD,
} from '../model';
import { AlertSeverity, useSnackBar } from '../hoc/SnackBar';
import { mediaTabSelector, sharedSelector } from '../selector';
import { OrbitNetworkErrorRetries } from '../../api-variable';
import { formatUploadTerminalFailureMessage } from '../store/upload/uploadTerminalMessages';
import { perfTrace } from '../utils/perf';

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
    data?: any
  ): Promise<void> => {
    perfTrace('UP.itemComplete', {
      success,
      stringId: data?.stringId ?? '(none)',
      offlinePath: !data?.stringId && success && !!data,
    });
    if (!success) setOrbitRetries(OrbitNetworkErrorRetries - 1); //notify of possible network issue
    const uploadList = fileList.current;
    if (!uploadList) return; // This should never happen
    if (data?.stringId) {
      mediaIdRef.current = data?.stringId;
    } else if (success && data) {
      // offlineOnly
      const num = getLatestVersion();
      perfTrace('UP.createMedia', { version: num, sourceMediaId });
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
        perfTrace('UP.afterUploadCb-start', { mediaId: mediaIdRef.current });
        await afterUploadCb(mediaIdRef.current);
        perfTrace('UP.afterUploadCb-done', { mediaId: mediaIdRef.current });
      } catch {
        // Parent after-upload hook failed; upload itself is finished.
      }
    };
    if (!getGlobal('offline') && mediaIdRef.current) {
      try {
        perfTrace('UP.pull-start', { mediaId: mediaIdRef.current });
        await pullTableList(
          'mediafile',
          Array(mediaIdRef.current),
          memory,
          remote,
          backup,
          reporter
        );
        perfTrace('UP.pull-done', { mediaId: mediaIdRef.current });
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
      const getArtifactId = () => {
        if (artifactId === null) return null;
        // Normal case: the artifacttype has a server id in the keyMap.
        const direct = remoteIdNum(
          'artifacttype',
          artifactId,
          memory?.keyMap as RecordKeyMap
        );
        if (!Number.isNaN(direct)) return direct;
        // TT-7557: offlineSetup (makeArtifactTypeRecs) creates artifacttypes
        // locally with only a typename and no remote id, and steps can end up
        // referencing that local-only record. Posting its GUID as the FK makes
        // the API reject the mediafile with 422 ("Failed to convert '<guid>'
        // ... to Int32"), which then retries in a storm. Resolve to the
        // server-synced artifacttype of the same typename (which carries a
        // remoteId) so we always send an integer FK.
        const local = memory.cache.query((q) =>
          q.findRecord({ type: 'artifacttype', id: artifactId })
        ) as ArtifactTypeD | undefined;
        const typename = local?.attributes?.typename;
        if (typename) {
          const synced = (
            memory.cache.query((q) =>
              q.findRecords('artifacttype')
            ) as ArtifactTypeD[]
          ).find(
            (a) => a.attributes?.typename === typename && a.keys?.remoteId
          );
          if (synced?.keys?.remoteId) return parseInt(synced.keys.remoteId, 10);
        }
        // Still unresolved: fall back to the GUID (offline/create path handles
        // it; online, the upload guard below rejects with a clear message
        // instead of silently 422-looping).
        return artifactId;
      };
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

      perfTrace('UP.uploadMedia-enter', {
        filename: (files[0] as File)?.name,
        artifactId,
        sourceMediaId,
        sourceSegments,
        languagebcp47,
      });
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
      // A relationship id that is NOT all-digits is an unresolved local GUID —
      // the server can't map it to an integer PK and rejects the POST with 422.
      const stillGuid = (v: unknown) =>
        typeof v === 'string' && v !== '' && !/^\d+$/.test(v);
      // When artifactType stays a GUID, does the in-memory record still carry
      // its own keys.remoteId? If yes -> the keyMap simply wasn't rebuilt on
      // restore (fix = repopulate keyMap). If undefined -> the record is truly
      // local-only (fix = ensure it gets a remote id before upload).
      let artifactTypeRecordKeyRemoteId: string | undefined | null = null;
      let artifactTypeTable: Array<{
        id: string;
        typename?: string;
        remoteId?: string;
      }> = [];
      if (artifactId) {
        try {
          const at = memory.cache.query((q) =>
            q.findRecord({ type: 'artifacttype', id: artifactId })
          ) as
            | { attributes?: { typename?: string }; keys?: { remoteId?: string } }
            | undefined;
          artifactTypeRecordKeyRemoteId = at?.keys?.remoteId ?? '(no keys.remoteId)';
          const all = memory.cache.query((q) =>
            q.findRecords('artifacttype')
          ) as Array<{
            id: string;
            attributes?: { typename?: string };
            keys?: { remoteId?: string };
          }>;
          const wanted = at?.attributes?.typename;
          artifactTypeTable = all
            .filter((a) => a.attributes?.typename === wanted)
            .map((a) => ({
              id: a.id,
              typename: a.attributes?.typename,
              remoteId: a.keys?.remoteId,
            }));
        } catch {
          artifactTypeRecordKeyRemoteId = '(record not found)';
        }
      }
      perfTrace('UP.resolved-fks', {
        planId: mediafile.planId,
        artifactTypeId: mediafile.artifactTypeId,
        passageId: mediafile.passageId,
        sourceMediaId: mediafile.sourceMediaId,
        recordedbyUserId: mediafile.recordedbyUserId,
        artifactTypeRecordKeyRemoteId,
        artifactTypeTable,
        unresolvedGuids: [
          ['plan', mediafile.planId],
          ['artifactType', mediafile.artifactTypeId],
          ['passage', mediafile.passageId],
          ['sourceMedia', mediafile.sourceMediaId],
          ['recordedbyUser', mediafile.recordedbyUserId],
        ]
          .filter(([, v]) => stillGuid(v))
          .map(([k]) => k),
      });
      // Fail fast instead of 422-looping: an online POST with an unresolved
      // GUID relationship id (e.g. artifact-type never got a server id) is
      // guaranteed to be rejected and retried UPLOAD_MAX_ATTEMPTS times. Reject
      // once with a clear, greppable message.
      if (!getGlobal('offline')) {
        const badFk = [
          ['plan', mediafile.planId],
          ['artifactType', mediafile.artifactTypeId],
          ['passage', mediafile.passageId],
          ['sourceMedia', mediafile.sourceMediaId],
          ['recordedbyUser', mediafile.recordedbyUserId],
        ].find(([, v]) => stillGuid(v));
        if (badFk) {
          const msg = `Cannot upload: ${badFk[0]} has no server id yet (${badFk[1]}). It has not finished syncing.`;
          showMessage(msg, AlertSeverity.Warning);
          reject(new Error(msg));
          return;
        }
      }
      nextUpload({
        record: mediafile,
        files,
        n: 0,
        token: accessToken || '',
        offline: getGlobal('offline'),
        errorReporter: reporter,
        uploadType: UploadType.Media,
        cb: (n, success, data) => {
          perfTrace('UP.nextUpload-cb', { n, success });
          void itemComplete(n, success, data)
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
