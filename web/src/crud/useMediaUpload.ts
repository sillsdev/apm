import { RefObject, useContext, useEffect, useRef } from 'react';
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
import { NO_LIST_TYPES, UploadType } from '../components/UploadType';
import { RecordKeyMap } from '@orbit/records';
import { getContentType } from '../utils/contentType';
import { ISharedStrings, MediaFileAttributes, MediaFileD } from '../model';
import { AlertSeverity, useSnackBar } from '../hoc/SnackBar';
import { mediaTabSelector, sharedSelector } from '../selector';
import { OrbitNetworkErrorRetries } from '../../api-variable';
import { formatUploadTerminalFailureMessage } from '../store/upload/uploadTerminalMessages';
import { passageDefaultSuffix } from '../utils/passageDefaultFilename';
import { typeLimit } from '../utils/typeLimit';
import { infoMsg, logError, Severity } from '../utils';
import { toError } from '../utils/toError';
import path from 'path-browserify';
import type { PendingRestoreInput } from '../store/upload/pendingMediaUploads';

/**
 * The values that become the uploaded mediafile (its attributes and
 * relationships). Grouped into one object so they don't flood the hook's
 * top-level props
 */
export interface IMediaUploadFields {
  artifactId: string | null;
  passageId?: string | undefined;
  /** Local Orbit plan id (UUID). Defaults to the global `plan`; converted to the
   *  remote id via `getRemotePlanId` where the vendor record needs it. */
  localPlanId?: string | undefined;
  sourceMediaId?: string | undefined;
  sourceSegments?: string | undefined;
  performedBy?: string | undefined;
  topic?: string | undefined;
  /** Copied onto mediafile.attributes.languagebcp47 (e.g. `English|en`). */
  languagebcp47?: string | undefined;
  /** When set, overrides the computed eafUrl (the upload path passes AI/eaf urls). */
  eafUrl?: string | undefined;
  /** Transcript stored on the mediafile (e.g. a Faithbridge link's transcript). */
  transcription?: string | undefined;
}

export interface IMediaUploadProps {
  fields: IMediaUploadFields;
  /** Defaults to UploadType.Media. Link/MarkDown/Faithbridge skip UPLOAD_LIST + versioning. */
  uploadType?: UploadType | undefined;
  /**
   * Domain restore metadata for pending-upload Retry (TT-7363). May be a getter
   * so callers can capture live comment/speaker state at upload time.
   */
  pendingRestore?: PendingRestoreInput | undefined;
  /** When retrying a queued failed upload, pass id to clear the queue entry after success. */
  pendingUploadIdToClearOnSuccess?: string | undefined;
  /**
   * Per-file follow-up, run inside nextUpload's callback — i.e. BEFORE the
   * pending-upload row is cleared — so a failing follow-up leaves Retry
   * available (TT-7363). The record paths (MediaRecord/Discussions) use this;
   * batch callers that only need "all done" use `finish`.
   */
  afterUploadCb?: ((mediaId: string) => Promise<void>) | undefined;
  /**
   * Commit deferred metadata (e.g. a newly typed artifact category) before
   * staging the upload and evaluating `pendingRestore`. Uploader's recorded
   * path forwards this here and does not await it again in afterUploadCb
   * (TT-7363 Copilot r3919030521).
   */
  beforeUpload?: (() => Promise<void>) | undefined;
  /** Called once the whole batch finishes, with the uploaded ids. */
  finish?: ((mediaRemoteIds?: string[]) => void | Promise<void>) | undefined;
  /** Abort the remaining files mid-batch (set by a dialog's Cancel). */
  cancelled?: RefObject<boolean> | undefined;
  /** Skip marking importexportBusy while uploading (the caller manages it). */
  noBusy?: boolean | undefined;
  /** When true, do not wait for `importexportBusy` before staging upload (record save may hold it). */
  skipImportExportWait?: boolean | undefined;
  /** Opt in to passage filename versioning (upload tab); recordings omit it. */
  versionFilenames?: boolean | undefined;
  importList?: File[] | undefined;
}

/**
 * The single upload pipeline for both one file and many: builds the vendor
 * record per file, drives nextUpload, handles offline createMedia + sync, shows
 * one completion message, and resolves `Promise<boolean>` (true if any file
 * uploaded; rejects only if every file failed). A single upload is just the
 * length-1 case, so single and multi behave identically.
 */
export const useMediaUpload = ({
  fields,
  uploadType,
  pendingRestore,
  pendingUploadIdToClearOnSuccess,
  afterUploadCb,
  beforeUpload,
  finish,
  cancelled,
  noBusy,
  skipImportExportWait,
  versionFilenames,
  importList,
}: IMediaUploadProps) => {
  const dispatch = useDispatch();
  const uploadFiles = (files: File[]) =>
    dispatch(actions.uploadFiles(files) as any);
  const nextUpload = (p: actions.NextUploadProps) =>
    dispatch(actions.nextUpload(p) as any);
  const uploadComplete = () => dispatch(actions.uploadComplete() as any);
  const { showMessage } = useSnackBar();
  const [reporter] = useGlobal('errorReporter');
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan');
  const [coordinator] = useGlobal('coordinator');
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const getGlobal = useGetGlobal();
  const [user] = useGlobal('user');
  const [, setBusy] = useGlobal('importexportBusy');
  const [, setComplete] = useGlobal('progress');
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? null;
  // TT-6646: a stale upload closure can run after the user typed speaker/topic
  // (MediaRecord's save effect omits them from deps). Read latest from refs.
  const performedByRef = useRef(fields.performedBy);
  const topicRef = useRef(fields.topic);
  useEffect(() => {
    performedByRef.current = fields.performedBy;
    topicRef.current = fields.topic;
  }, [fields.performedBy, fields.topic]);
  const { createMedia } = useOfflnMediafileCreate();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t = useSelector(mediaTabSelector, shallowEqual);
  const { localizedArtifactTypeFromId } = useArtifactType();
  const [, setOrbitRetries] = useGlobal('orbitRetries'); //verified this is not used in a function 2/18/25
  const effectiveType = uploadType ?? UploadType.Media;

  const getLatestVersion = () => {
    let num = 1;
    const psgId = fields.passageId || '';
    if (psgId && !fields.artifactId) {
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

  // Callers that don't name a plan (e.g. the audio upload dialog) upload into
  // whatever plan is currently open.
  const localPlanId = fields.localPlanId || plan;
  const getRemotePlanId = () =>
    remoteIdNum('plan', localPlanId, memory?.keyMap as RecordKeyMap) ||
    localPlanId;
  const getArtifactId = () =>
    fields.artifactId === null
      ? null
      : remoteIdNum(
          'artifacttype',
          fields.artifactId,
          memory?.keyMap as RecordKeyMap
        ) || fields.artifactId;
  const getPassageId = () =>
    fields.passageId
      ? remoteIdNum(
          'passage',
          fields.passageId,
          memory?.keyMap as RecordKeyMap
        ) || fields.passageId
      : '';
  const getUserId = () =>
    remoteIdNum('user', user, memory?.keyMap as RecordKeyMap) || user;
  const getSourceMediaId = () =>
    remoteIdNum(
      'mediafile',
      fields.sourceMediaId || '',
      memory?.keyMap as RecordKeyMap
    ) || fields.sourceMediaId;

  /** Build the vendor record for one file. */
  const buildRecord = (file: File) => {
    return {
      planId: getRemotePlanId(),
      versionNumber: 1,
      originalFile: file.name,
      contentType: getContentType(file.type, file.name),
      artifactTypeId: getArtifactId(),
      passageId: getPassageId(),
      recordedbyUserId: getUserId(),
      userId: getUserId(),
      sourceMediaId: getSourceMediaId(),
      sourceSegments: fields.sourceSegments ?? '{}',
      performedBy: performedByRef.current ?? null,
      topic: topicRef.current ?? '',
      languagebcp47: fields.languagebcp47 ?? '',
      eafUrl:
        fields.eafUrl ??
        (!fields.artifactId
          ? ts.mediaAttached
          : localizedArtifactTypeFromId(fields.artifactId)), //put psc message here
      transcription: fields.transcription ?? '',
    } as MediaFileAttributes & {
      planId: string;
      artifactTypeId: string;
      passageId: string;
      recordedbyUserId: string;
      userId: string;
      sourceMediaId: string;
    };
  };

  /** Rename files that lack the passage version suffix (opt-in, upload tab only). */
  const applyVersionSuffix = (files: File[]) => {
    if (!versionFilenames || NO_LIST_TYPES.includes(effectiveType))
      return files;
    // passageDefaultSuffix looks the plan up in the local Orbit cache, so it
    // needs the local plan id (UUID)
    const suffix = passageDefaultSuffix(
      localPlanId as string,
      memory,
      getGlobal('offline')
    );
    return files.map((f) => {
      const base = path.basename(f.name, path.extname(f.name));
      if (base.endsWith(suffix)) return f;
      return new File([f], base + suffix + path.extname(f.name), {
        type: f?.type,
      });
    });
  };

  /**
   * Resolve one file's mediaId (string id, offline-created id, or '' on a
   * normal failure); throws only on offline createMedia bookkeeping failure.
   */
  const itemComplete = async (
    n: number,
    success: boolean,
    data: any,
    files: File[]
  ): Promise<string> => {
    if (!success) {
      setOrbitRetries(OrbitNetworkErrorRetries - 1); //notify of possible network issue
      return '';
    }
    if (data?.stringId) return data.stringId as string;
    if (data) {
      // offlineOnly
      const num = getLatestVersion();
      const created = await createMedia(
        data,
        num,
        (files[n] as File).size,
        fields.passageId ?? '',
        fields.artifactId,
        fields.sourceMediaId ?? '',
        user
      );
      return created.id;
    }
    return '';
  };

  // Surface a per-file upload error (unsupported type / too big / network).
  const showUploadError = (raw: string) => {
    let msg = raw;
    if (raw.indexOf('unsupported') > 0)
      msg = t.unsupported.replace(
        '{0}',
        raw.substring(0, raw.indexOf(':unsupported'))
      );
    else if (raw.indexOf('toobig') > 0) {
      msg = t.fileTooBig
        .replace('{0}', raw.substring(0, raw.indexOf(':toobig')))
        .replace(
          '{1}',
          raw.substring(raw.indexOf('toobig:') + 'toobig:'.length)
        )
        .replace('{2}', typeLimit(effectiveType).toString());
    }
    showMessage(msg, AlertSeverity.Error);
  };

  /** Upload one file; resolves its mediaId ('' on normal failure). */
  const uploadOne = (files: File[], n: number, gate: boolean) =>
    new Promise<string>((resolve, reject) => {
      const vndRecord = buildRecord(files[n] as File);
      nextUpload({
        record: vndRecord,
        files,
        n,
        token: accessToken || '',
        offline: getGlobal('offline'),
        errorReporter: reporter,
        uploadType: effectiveType,
        cb: (idx, upOk, data, errorMessage) => {
          if (errorMessage) showUploadError(errorMessage);
          void (async () => {
            try {
              const id = await itemComplete(idx, upOk, data, files);
              // TODO cleanup: pulling the mediafile here (before afterUploadCb)
              // would be more globally correct — every afterUploadCb consumer
              // would then get a keyMap-resolvable id like `finish` does — but it
              // risks widening this pre-row-clear window with a network round-trip
              // and changing timing for every recorder and its mocked tests.
              // Runs before nextUpload clears the pending row (TT-7363).
              if (afterUploadCb) {
                try {
                  await afterUploadCb(id);
                } catch {
                  // follow-up failed; the upload itself is finished.
                }
              }
              resolve(id);
            } catch (e) {
              reject(e);
            }
          })();
        },
        pendingUploadIdToClearOnSuccess,
        pendingRestore:
          typeof pendingRestore === 'function'
            ? pendingRestore()
            : pendingRestore,
        // First file waits only for import/export already in progress at start
        // (b79f7bdf); later files skip the wait. Applies to every path now
        // unless the caller opts out with skipImportExportWait.
        getImportExportBusy: gate
          ? () => Boolean(getGlobal('importexportBusy'))
          : undefined,
        onTerminalFailure: (info) => {
          showMessage(
            formatUploadTerminalFailureMessage(t, info),
            AlertSeverity.Warning
          );
        },
      });
    });

  const run = async (files: File[]): Promise<boolean> => {
    if (!files || files.length === 0) return false;
    if (beforeUpload) await beforeUpload();
    const staged = applyVersionSuffix(files);
    if (!NO_LIST_TYPES.includes(effectiveType)) uploadFiles(staged);
    const startedBusy = Boolean(getGlobal('importexportBusy'));
    if (!noBusy) setBusy(true);

    const ids: string[] = [];
    for (let n = 0; n < staged.length; n += 1) {
      if (cancelled?.current) break;
      // A thrown bookkeeping error (offline createMedia) aborts the batch; a
      // normal upload failure resolves '' and we carry on to the next file.
      const id = await uploadOne(
        staged,
        n,
        !skipImportExportWait && n === 0 && startedBusy
      );
      if (id) ids.push(id);
      setComplete(Math.min(((n + 1) * 100) / staged.length, 100));
    }

    if (!getGlobal('offline') && ids.length > 0) {
      try {
        await pullTableList('mediafile', ids, memory, remote, backup, reporter);
      } catch {
        // Sync failure still runs upload cleanup.
      }
    }
    uploadComplete();
    showMessage(
      t.uploadComplete
        .replace('{0}', String(ids.length))
        .replace('{1}', String(staged.length))
    );
    setComplete(0);
    if (!noBusy) setBusy(false);
    if (cancelled) cancelled.current = ids.length <= 0;
    if (finish) await finish(ids);
    if (ids.length === 0) throw new Error(t.uploadFailed);
    return true;
  };

  // TODO cleanup: this shouldn't need to be an effect. 1) consider
  // if we can get rid of importList altogether, and 2) whether we can
  // use a method that is passed and called instead of an effect
  // Imperative trigger: upload the handed-in list now (the deferred general-
  // resource flow drives the real upload this way). Always the real upload —
  // staging is a caller concern, so it can never re-stage here. May reject when
  // every file fails; the completion message already fired.
  useEffect(() => {
    if (importList && importList.length > 0) {
      void run(importList).catch((err: unknown) => {
        const error = toError(err);
        logError(
          Severity.error,
          reporter,
          infoMsg(error, 'import upload failed')
        );
        showMessage(error.message, AlertSeverity.Error);
      });
    }
    // Only a new importList should start an upload. `run`, `reporter` and
    // `showMessage` are left out: `run` is a new closure every render, so
    // listing it would re-upload the same list on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importList]);

  return run;
};
