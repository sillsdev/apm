import {
  IApiError,
  Role,
  Plan,
  OfflineProject,
  VProject,
  ExportType,
  UserD,
} from './model';
import Coordinator, {
  RequestStrategy,
  SyncStrategy,
  LogLevel,
  EventLoggingStrategy,
} from '@orbit/coordinator';
import Bugsnag from '@bugsnag/js';
import IndexedDBSource from '@orbit/indexeddb';
import IndexedDBBucket from '@orbit/indexeddb-bucket';
import JSONAPISource from '@orbit/jsonapi';
import { RecordOperation, RecordTransform } from '@orbit/records';
import { NetworkError } from '@orbit/jsonapi';
import { Bucket } from '@orbit/core';
import Memory from '@orbit/memory';
import { ITokenContext } from './context/TokenProvider';
import {
  API_CONFIG,
  isElectron,
  OrbitNetworkErrorRetries,
} from '../api-variable';
import {
  logError,
  infoMsg,
  Severity,
  LocalKey,
  orbitErr,
  orbitRetry,
  forceLogin,
  syncRemoteAuthHeaders,
  getHttpStatus,
} from './utils';
import { removeOrbitRemote } from './utils/removeOrbitRemote';
import { electronExport } from './store/importexport/electronExport';
import { restoreBackup } from './crud/restoreBackup';
import { AlertSeverity } from './hoc/SnackBar';
import { updateBackTranslationType } from './crud/updateBackTranslationType';
import { updateConsultantWorkflowStep } from './crud/updateConsultantWorkflowStep';
import { serializersSettings } from './serializers/serializersFor';
import { requestedSchema } from './schema';
import { logLoginAnalytics } from './crud/logLoginAnalytics';
import { orbitReset } from './crud/orbitReset';
type StategyError = (...args: unknown[]) => unknown;

interface PullStratErrProps {
  tokenCtx: ITokenContext;
  orbitError: (ex: IApiError) => void;
  setOrbitRetries: (r: number) => void;
  showMessage: (msg: string | React.JSX.Element, alert?: AlertSeverity) => void;
  memory: Memory;
  coordinator: Coordinator;
  fingerprint: string;
  orbitRetries: number;
  errorReporter: typeof Bugsnag | undefined;
}
interface QueryStratErrProps {
  tokenCtx: ITokenContext;
  orbitError: (ex: IApiError) => void;
  coordinator: Coordinator;
  fingerprint: string;
  setOrbitRetries: (r: number) => void;
}
let unauthorizedRetryAttempted = false;

const networkError = (ex: unknown): boolean =>
  ex instanceof NetworkError ||
  (ex instanceof Error &&
    (ex.message === 'Failed to fetch' || ex.message === 'Network Error'));

const isUnauthorized = (ex: unknown): boolean => getHttpStatus(ex) === 401;

const skipRemoteQueue = async (remote: JSONAPISource) => {
  const len = remote?.requestQueue?.length ?? 0;
  if (len > 0) {
    try {
      await remote.requestQueue.skip();
    } catch {
      // queue may already be settling
    }
  }
};

const addRemoteLinkStrategies = (coordinator: Coordinator) => {
  if (!coordinator.strategyNames.includes('remote-request'))
    coordinator.addStrategy(
      new RequestStrategy({
        name: 'remote-request',
        source: 'memory',
        on: 'beforeQuery',
        target: 'remote',
        action: 'query',
        blocking: false,
      })
    );
  if (!coordinator.strategyNames.includes('remote-update'))
    coordinator.addStrategy(
      new RequestStrategy({
        name: 'remote-update',
        source: 'memory',
        on: 'beforeUpdate',
        target: 'remote',
        action: 'update',
        blocking: false,
      })
    );
  if (!coordinator.strategyNames.includes('remote-sync'))
    coordinator.addStrategy(
      new SyncStrategy({
        name: 'remote-sync',
        source: 'remote',
        target: 'memory',
        blocking: true,
      })
    );
};

const handleUnauthorized = (
  tokenCtx: ITokenContext,
  coordinator: Coordinator,
  fingerprint: string,
  setOrbitRetries: (r: number) => void
) => {
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const datachangeremote = coordinator?.getSource(
    'datachanges'
  ) as JSONAPISource;
  const token = tokenCtx?.state?.accessToken;
  if (token && remote && !unauthorizedRetryAttempted) {
    unauthorizedRetryAttempted = true;
    syncRemoteAuthHeaders(remote, token, fingerprint);
    syncRemoteAuthHeaders(datachangeremote, token, fingerprint);
    return remote.requestQueue.retry;
  }
  unauthorizedRetryAttempted = false;
  setOrbitRetries(OrbitNetworkErrorRetries);
  tokenCtx?.state?.invalidateOnlineSession();
  forceLogin();
  localStorage.setItem(LocalKey.offlineAdmin, 'false');
  void skipRemoteQueue(remote);
  return remote.requestQueue.skip();
};

const queryError =
  ({
    tokenCtx,
    orbitError,
    coordinator,
    fingerprint,
    setOrbitRetries,
  }: QueryStratErrProps) =>
  (transform: RecordTransform, ex: unknown) => {
    const remote = coordinator?.getSource('remote') as JSONAPISource;
    console.log('***** api query fail', transform, ex);
    if (isUnauthorized(ex)) {
      return handleUnauthorized(
        tokenCtx,
        coordinator,
        fingerprint,
        setOrbitRetries
      );
    } else if (networkError(ex)) {
      orbitError(ex as IApiError);
      //signal to datachanges that we've had a network error
      setOrbitRetries(OrbitNetworkErrorRetries - 1);
    }
    return remote.requestQueue.retry;
  };

const updateError =
  ({
    tokenCtx,
    orbitError,
    setOrbitRetries,
    showMessage,
    memory,
    coordinator,
    fingerprint,
    orbitRetries,
  }: PullStratErrProps) =>
  (transform: RecordTransform, ex: unknown) => {
    const remote = coordinator?.getSource('remote') as JSONAPISource;
    console.log('***** api update fail', transform, ex);
    if (isUnauthorized(ex)) {
      return handleUnauthorized(
        tokenCtx,
        coordinator,
        fingerprint,
        setOrbitRetries
      );
    } else if (networkError(ex)) {
      if (orbitRetries > 0) {
        setOrbitRetries(orbitRetries - 1);
        // When network errors are encountered, try again in 3s
        orbitError(orbitRetry(null, 'NetworkError - will try again soon'));
        setTimeout(() => {
          remote.requestQueue.retry();
        }, 3000);
      } else {
        //ran out of retries -- bucket will retry later
      }
    } else {
      // When non-network errors occur, notify the user and
      // reset state.
      const data = (
        ex as { data: { errors: Array<{ meta: { stackTrace: string[] } }> } }
      ).data;
      const detail =
        data?.errors && Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors[0]?.meta && data.errors[0]?.meta?.stackTrace?.[0]
          : undefined;

      if (detail?.includes('Entity has been deleted')) {
        console.log('***attempt to update deleted record');
        showMessage(detail);
      } else {
        const response = (ex as { response: { url: string } }).response;
        const url: string = response?.url ?? '';
        const myOp = transform.operations;
        const firstOp = Array.isArray(myOp)
          ? (myOp[0] as RecordOperation)
          : myOp;
        const label =
          (transform?.options?.label ||
            firstOp.op + (url ? ` in ` + url.split('/').pop() + `: ` : '')) +
          (detail ?? '');
        orbitError(
          orbitErr(
            ex as IApiError | Error | null,
            `Unable to complete "${label}"`
          )
        );
      }

      // Roll back memory to position before transform
      if (memory.transformLog.contains(transform.id)) {
        //don't do this -- resets error to 0 and takes user away from continue/logout screen
        //orbitError(
        //  orbitInfo(null, 'Rolling back - transform:' + transform.id)
        //);
        memory.rollback(transform.id, -1);
      }

      return remote.requestQueue.skip();
    }
  };

interface SourcesReturn {
  syncBuffer: Buffer | undefined;
  syncFile: string;
  goRemote: boolean;
}

export const Sources = async (
  coordinator: Coordinator,
  tokenCtx: ITokenContext,
  fingerprint: string,
  errorReporter: typeof Bugsnag | undefined,
  orbitRetries: number,
  setUser: (id: string) => void,
  setProjectsLoaded: (value: string[]) => void,
  orbitError: (ex: IApiError) => void,
  setOrbitRetries: (r: number) => void,
  setLang: (locale: string) => void,
  getOfflineProject: (plan: Plan | VProject | string) => OfflineProject,
  offlineSetup: () => Promise<void>,
  showMessage: (msg: string | React.JSX.Element, alert?: AlertSeverity) => void,
  forceDataChanges: () => Promise<void>
): Promise<SourcesReturn> => {
  const memory = coordinator?.getSource('memory') as Memory;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const tokenState = tokenCtx?.state ?? {
    accessToken: null,
    profile: undefined,
  };
  const tokData = tokenState.profile || { sub: '' };
  const userToken = localStorage.getItem(LocalKey.authId);
  if (tokData.sub !== '') {
    localStorage.setItem(LocalKey.authId, tokData.sub || '');
  }

  const bucket = new IndexedDBBucket({
    namespace:
      'transcriber-' + (tokData.sub || '').replace(/\|/g, '-') + '-bucket',
  }) as Bucket;

  //set up strategies
  // Update indexedDb when memory updated
  if (!coordinator.strategyNames.includes('sync-backup'))
    coordinator.addStrategy(
      new SyncStrategy({
        name: 'sync-backup',
        source: 'memory',
        target: 'backup',
        blocking: true,
      })
    );
  if (!coordinator.strategyNames.includes('logging'))
    coordinator.addStrategy(new EventLoggingStrategy({ name: 'logging' }));

  let remote: JSONAPISource = {} as JSONAPISource;
  let datachangeremote: JSONAPISource = {} as JSONAPISource;

  const offline = !tokenState.accessToken;

  if (!offline) {
    unauthorizedRetryAttempted = false;
    if (coordinator.sourceNames.includes('remote')) {
      await removeOrbitRemote(coordinator, false);
    }
    if (coordinator.activated) {
      await coordinator.deactivate();
    }
    remote = new JSONAPISource({
      schema: memory?.schema,
      keyMap: memory?.keyMap,
      ...(isElectron ? { bucket } : {}),
      name: 'remote',
      namespace: 'api',
      host: API_CONFIG.host,
      serializerSettingsFor: serializersSettings(),
      defaultFetchSettings: {
        headers: {
          Authorization: 'Bearer ' + (tokenState.accessToken || ''),
          'X-FP': fingerprint,
        },
        timeout: 100000,
      },
      defaultTransformOptions: {
        useRemoteId: true,
      },
    });
    try {
      await remote.activated;
    } catch (ex) {
      if (isUnauthorized(ex)) {
        await skipRemoteQueue(remote);
      }
    }
    if (!coordinator.sourceNames.includes('remote')) {
      coordinator.addSource(remote);
    }

    // Trap error querying data (token expired or offline)
    if (!coordinator.strategyNames.includes('remote-query-fail'))
      coordinator.addStrategy(
        new RequestStrategy({
          name: 'remote-query-fail',

          source: 'remote',
          on: 'queryFail',
          action: queryError({
            tokenCtx,
            orbitError,
            coordinator,
            fingerprint,
            setOrbitRetries,
          }) as unknown as StategyError,
          blocking: true,
        })
      );
    if (!coordinator.strategyNames.includes('remote-update-fail'))
      coordinator.addStrategy(
        new RequestStrategy({
          name: 'remote-update-fail',

          source: 'remote',
          on: 'updateFail',
          action: updateError({
            tokenCtx,
            orbitError,
            setOrbitRetries,
            showMessage,
            memory,
            coordinator,
            fingerprint,
            orbitRetries,
            errorReporter,
          }) as unknown as StategyError,
          blocking: true,
        })
      );
    addRemoteLinkStrategies(coordinator);

    datachangeremote = coordinator.sourceNames.includes('datachanges')
      ? (coordinator?.getSource('datachanges') as JSONAPISource)
      : new JSONAPISource({
          schema: memory?.schema,
          keyMap: memory?.keyMap,
          bucket: new IndexedDBBucket({
            namespace:
              'datachanges-' +
              (tokData.sub || '').replace(/\|/g, '-') +
              '-bucket',
          }),
          name: 'datachanges',
          namespace: 'api',
          host: API_CONFIG.host,
          serializerSettingsFor: serializersSettings(),
          defaultFetchSettings: {
            headers: {
              Authorization: 'Bearer ' + (tokenState.accessToken || ''),
              'X-FP': fingerprint,
            },
            timeout: 100000,
          },
          defaultTransformOptions: {
            useRemoteId: true,
          },
        });
    if (!coordinator.sourceNames.includes('datachanges')) {
      coordinator.addSource(datachangeremote);
    }
  } //!offline
  let goRemote =
    !offline &&
    (userToken !== tokData.sub || localStorage.getItem('inviteId') !== null);
  if (!goRemote) {
    console.log('using backup');
    if (!isElectron) {
      //already did this if electron...
      setProjectsLoaded(await restoreBackup(coordinator));
      const recs = memory?.cache.query((q) => q.findRecords('role')) as Role[];
      if (recs.length === 0) {
        //orbitError(orbitInfo(null, 'Indexed DB corrupt or missing.'));
        goRemote = true;
      }
    }
    //get v4 data
    if (requestedSchema > 3) {
      if (offline) {
        await offlineSetup();
      }
    }
  }

  if (!coordinator.activated)
    await coordinator.activate({ logLevel: LogLevel.Warnings });

  console.log('Coordinator will log warnings');

  let syncBuffer: Buffer | undefined = undefined;
  let syncFile = '';
  if (!offline && isElectron) {
    const fr = await electronExport(
      ExportType.ITFSYNC,
      undefined, //all artifact types
      memory,
      backup,
      0,
      0,
      '',
      '',
      getOfflineProject
    ).catch((err: Error) => {
      console.log(
        'ITFSYNC export failed: ',
        err.message,
        err.name,
        err.cause,
        err.stack
      );
      logError(
        Severity.error,
        errorReporter,
        infoMsg(err, 'ITFSYNC export failed: ')
      );
      throw err;
    });
    if (fr && fr.changes > 0) {
      syncBuffer = fr.buffer;
      syncFile = fr.message;
    }
  }
  /* set the user from the token - must be done after the backup is loaded and after changes to offline are recorded */
  if (!offline) {
    console.log(`Activating remote for user: ${tokData.sub}`);
    await skipRemoteQueue(remote);
    await remote.activated;
    console.log(`Activated remote for user: ${tokData.sub}`);
    let uRecs = (await remote.query((q) =>
      q
        .findRecords('user')
        .filter({ attribute: 'auth0Id', value: tokData.sub })
    )) as UserD[];
    console.log(`has user rec: ${tokData.sub}`);
    if (!Array.isArray(uRecs)) uRecs = [uRecs];
    const user = uRecs[0] as UserD;
    const locale = user?.attributes?.locale || 'en';
    setLang(locale);
    localStorage.setItem(LocalKey.userId, user.id);
    localStorage.setItem(LocalKey.onlineUserId, user.id);
    if (errorReporter && localStorage.getItem(LocalKey.connected) !== 'false')
      Bugsnag.setUser(user.keys?.remoteId ?? user.id);
    if (remote.requestQueue?.length > 0) {
      console.log(
        'Remote request queue is not empty',
        remote.requestQueue?.length
      );
      await orbitReset(remote, setOrbitRetries);
    }
    if (
      new Date().getTime() - new Date(user.attributes.dateUpdated).getTime() <=
      60000
    ) {
      console.log(`Forcing data changes`);
      await forceDataChanges();
      console.log(`Forcing complete`);
    }
    logLoginAnalytics(tokenState.accessToken, errorReporter);
  }
  const user = localStorage.getItem(LocalKey.userId) as string;
  setUser(user);
  if (requestedSchema > 4) {
    console.log(`Updating translation type`);
    await updateBackTranslationType(
      memory,
      tokenState.accessToken || '',
      user,
      errorReporter,
      offlineSetup
    );
  }
  if (requestedSchema > 5) {
    const token = tokenState.accessToken || null;
    console.log(`Updating consultant workflow step`);
    await updateConsultantWorkflowStep(token, memory, user);
  }
  return { syncBuffer, syncFile, goRemote };
};
