import path from 'path-browserify';
import { DateTime } from 'luxon';
import { IElectronImportStrings, IState, IApiError, ProjectD } from '../model';
import {
  remoteIdGuid,
  useArtifactType,
  useOfflineSetup,
  useOfflnProjRead,
} from '../crud';
import {
  dataPath,
  LocalKey,
  localUserKey,
  orbitInfo,
  useProjectsLoaded,
} from '../utils';
import { isElectron } from '../../api-variable';
import { useContext, useRef } from 'react';
import { useGlobal } from '../context/useGlobal';
import localStrings from '../selector/localize';
import { useSelector, shallowEqual } from 'react-redux';
import { useSnackBar } from '../hoc/SnackBar';
import IndexedDBSource from '@orbit/indexeddb';
import { TokenContext } from '../context/TokenProvider';
import { ImportProjectToElectronProps } from '../store';
import { RecordKeyMap } from '@orbit/records';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export interface IImportData {
  fileName: string;
  projectName: string;
  valid: boolean;
  warnMsg: string | React.JSX.Element;
  errMsg: string;
  exportDate: string;
}

const stringSelector = (state: IState) =>
  localStrings(state as IState, { layout: 'electronImport' });

//const importStatusSelector = (state: IState) =>
//  state.importexport.importexportStatus;

export const useElectronImport = () => {
  const [coordinator] = useGlobal('coordinator');
  const token = useContext(TokenContext)?.state?.accessToken ?? null;
  const [errorReporter] = useGlobal('errorReporter');
  const offlineSetup = useOfflineSetup();
  const [user] = useGlobal('user');
  const [memory] = useGlobal('memory');
  const isOfflinePtf = useRef<boolean>(false);
  const { showTitledMessage } = useSnackBar();
  const getOfflineProject = useOfflnProjRead();
  const AddProjectLoaded = useProjectsLoaded();
  const zipRef = useRef<string | undefined>(undefined);
  const t = useSelector(stringSelector, shallowEqual) as IElectronImportStrings;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const { getTypeId } = useArtifactType();

  const invalidReturn = {
    fileName: '',
    projectName: '',
    valid: false,
    warnMsg: '',
    errMsg: '',
    exportDate: '',
  };
  //let importStatus = useSelector(importStatusSelector, shallowEqual);

  const getData = async (zip: string, name: string) => {
    const text = (await ipc?.zipStreamEntryText(zip, name)) as string;
    return text.replace(/(\r\n|\n|\r)/gm, '');
  };

  interface IEntry {
    attr: number;
    comLen: number; // comment length
    comment: string | null;
    compressedSize: number;
    crc: number;
    diskStart: number;
    extraLen: number;
    flags: number;
    fnameLen: number;
    headerOffset: number;
    inattr: number;
    isDirectory: boolean;
    method: number;
    name: string;
    offset: number;
    size: number;
    time: number;
    verMade: number;
    version: number;
  }

  const getElectronImportData = async (
    project: string
  ): Promise<IImportData> => {
    if (!isElectron) return invalidReturn;
    const filePaths = await ipc?.importOpen();
    if (!filePaths || filePaths.length === 0) {
      zipRef.current = undefined;
      //they didn't pick a file
      return invalidReturn;
    }
    const zip = await ipc?.zipStreamOpen(filePaths[0]);
    let valid = false;
    let exportTime: DateTime = DateTime.utc();
    let exportDate = '';
    let version = '3';
    const zipEntries = JSON.parse(await ipc?.zipStreamEntries(zip));
    for (const entry of Object.values(zipEntries) as IEntry[]) {
      if (entry.name === 'SILTranscriber') {
        exportDate = await getData(zip, 'SILTranscriber');
        exportTime = DateTime.fromISO(exportDate);
        valid = true;
        if (isOfflinePtf.current) break;
      } else if (entry.name === 'Offline') {
        isOfflinePtf.current = true;
        if (valid) break;
      } else if (entry.name === 'Version') {
        version = await getData(zip, 'Version');
      }
    }
    if (!valid) {
      showTitledMessage(t.importProject, t.ptfError);
      zipRef.current = undefined;
      isOfflinePtf.current = false;
      return { ...invalidReturn, errMsg: t.ptfError };
    }

    //we have a valid file
    zipRef.current = filePaths[0];
    const ret: IImportData = {
      fileName: filePaths[0],
      projectName: '',
      valid: true,
      warnMsg: '',
      errMsg: '',
      exportDate: exportDate,
    };
    if ((backup?.schema.version || 1) < parseInt(version)) {
      ret.warnMsg = t.newerVersion;
    }
    let userInProject = false;
    const users = new Set<string>();
    const importUsers = JSON.parse(
      await ipc?.zipStreamEntryText(zip, 'data/A_users.json')
    );
    if (importUsers && Array.isArray(importUsers.data)) {
      importUsers.data.forEach((u: any) => {
        users.add(u.attributes.name);
        if (
          user === '' ||
          remoteIdGuid('user', u.id, memory?.keyMap as RecordKeyMap) ||
          u.id === user
        )
          userInProject = true;
      });
    }
    const importProjs = JSON.parse(
      await ipc?.zipStreamEntryText(zip, 'data/D_projects.json')
    );
    let importProj: any;
    if (
      importProjs &&
      Array.isArray(importProjs.data) &&
      importProjs.data.length > 0
    ) {
      importProj = importProjs.data[0];
      ret.projectName = importProj.attributes.name;
    } else {
      return { ...invalidReturn, errMsg: t.ptfError };
    }
    const infoMsg = (
      <span>
        {filePaths[0]}
        <br />
        <b>
          {t.project}: {ret.projectName}
        </b>
        <br />
        {t.members}: {Array.from(users).sort().join(', ')}
        <br />
        <b>
          {userInProject ? (
            <></>
          ) : (
            <>
              {t.userWontSeeProject}
              <br />
            </>
          )}
        </b>
      </span>
    );

    //if we already have projects...check dates
    const projectRecs = memory.cache.query((q) =>
      q.findRecords('project')
    ) as ProjectD[];
    if (projectRecs && projectRecs.length > 0) {
      let projectNames: string = '';
      const id = importProj.id;
      const proj = projectRecs.find(
        (pr) =>
          pr.id ===
          (remoteIdGuid('project', id, memory?.keyMap as RecordKeyMap) || id)
      );

      if (project !== '' && project !== proj?.id) {
        showTitledMessage(t.importProject, t.invalidProject);
        zipRef.current = undefined;
        ret.valid = false;
        ret.errMsg = t.invalidProject;
        return ret;
      }

      //was this one exported before our current data?
      if (proj && proj.attributes) {
        projectNames += proj.attributes.name + ',';
        const op = getOfflineProject(proj.id);
        if (
          op.attributes &&
          op.attributes.snapshotDate &&
          DateTime.fromISO(op.attributes.snapshotDate) > exportTime
        ) {
          ret.warnMsg +=
            t.importCreated.replace('{date0}', exportTime.toLocaleString()) +
            ' ' +
            t.projectImported
              .replace('{name0}', importProj.attributes.name)
              .replace(
                '{date1}',
                DateTime.fromISO(op.attributes.snapshotDate).toLocaleString()
              ) +
            '  ' +
            t.allDataOverwritten.replace('{name0}', ret.projectName);
        }
        //has our current data never been exported, or exported after incoming?
        if (!op.attributes || !op.attributes.exportedDate) {
          ret.warnMsg +=
            t.neverExported.replace('{name0}', ret.projectName) +
            '  ' +
            t.allDataOverwritten.replace('{name0}', ret.projectName);
        } else {
          const myLastExport = DateTime.fromISO(op.attributes.exportedDate);
          if (myLastExport > exportTime) {
            ret.warnMsg +=
              t.importCreated.replace('{date0}', exportTime.toLocaleString()) +
              ' ' +
              t.lastExported
                .replace('{name0}', ret.projectName)
                .replace('{date0}', myLastExport.toLocaleString()) +
              '  ' +
              t.exportedLost;
          }
        }
      }

      if (ret.warnMsg === '' && projectNames !== '') {
        //general warning
        ret.warnMsg = t.allDataOverwritten.replace(
          '{name0}',
          projectNames.substring(0, projectNames.length - 1)
        );
      }
    }
    ret.warnMsg = (
      <span>
        {infoMsg}
        <br />
        {ret.warnMsg}
      </span>
    );
    return ret;
  };

  const getFileText = async (folder: string, name: string) => {
    const value = (await ipc?.read(path.join(folder, name), 'utf-8')) as string;
    return value.replace(/(\r\n|\n|\r)/gm, '');
  };

  const handleElectronImport = async (
    importProjectToElectron: (props: ImportProjectToElectronProps) => void,
    reportError: (ex: IApiError) => void
  ): Promise<void> => {
    if (!isElectron) return;
    if (zipRef.current) {
      const where = await dataPath();
      await ipc?.createFolder(where);
      //delete any old files
      try {
        if (await ipc?.exists(path.join(where, 'SILTranscriber')))
          await ipc?.delete(path.join(where, 'SILTranscriber'));
        if (await ipc?.exists(path.join(where, 'Version')))
          await ipc?.delete(path.join(where, 'Version'));
        const datapath = path.join(where, 'data');
        if (await ipc?.exists(datapath)) {
          const files = await ipc?.readDir(datapath);
          for (const file of files) {
            await ipc?.delete(path.join(datapath, file));
          }
        }
      } catch (errResult: unknown) {
        const err = errResult as Error & { errno: number };
        if (err.errno !== -4058)
          reportError(orbitInfo(err, `Delete failed for ${where}`));
      }
      await ipc?.zipStreamExtract(zipRef.current, where);
      //get the exported date from SILTranscriber file
      const dataDate = await getFileText(where, 'SILTranscriber');
      let versionstr = '3';
      if (await ipc?.exists(path.join(where, 'Version')))
        versionstr = await getFileText(where, 'Version');
      const version = parseInt(versionstr);
      importProjectToElectron({
        filepath: path.join(where, 'data'),
        dataDate,
        version,
        coordinator,
        offlineOnly: isOfflinePtf.current,
        AddProjectLoaded,
        reportError,
        getTypeId,
        pendingmsg: t.importPending,
        completemsg: t.importComplete,
        oldfilemsg: t.importOldFile,
        token,
        user,
        errorReporter,
        offlineSetup,
      });
      const userLastTimeKey = localUserKey(LocalKey.time);
      const lastTime = localStorage.getItem(userLastTimeKey) || '';
      if (
        !lastTime ||
        DateTime.fromISO(lastTime) > DateTime.fromISO(dataDate)
      ) {
        localStorage.setItem(userLastTimeKey, dataDate);
      }
      isOfflinePtf.current = false;
    }
  };
  return { getElectronImportData, handleElectronImport };
};
