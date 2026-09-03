import { ExportType, FileResponse } from './types';
import path from 'path-browserify';
import { DateTime } from 'luxon';
import {
  Organization,
  Plan,
  OfflineProject,
  VProject,
  OrgWorkflowStep,
  ProjectD,
  UserD,
  MediaFileD,
} from '../../model';
import Memory from '@orbit/memory';
import { getSerializer } from '../../serializers/getSerializer';
import { InitializedRecord, RecordKeyMap } from '@orbit/records';
import {
  related,
  remoteId,
  getMediaEaf,
  remoteIdGuid,
  getBurritoMeta,
  scriptureFullPath,
  IBurritoMeta,
  IExportScripturePath,
  fileInfo,
  updateableFiles,
  staticFiles,
  nameFromTemplate,
  VernacularTag,
  findRecord,
} from '../../crud';
import {
  dataPath,
  cleanFileName,
  currentDateTime,
  PathType,
  createFolder,
  createPathFolder,
} from '../../utils';
import IndexedDBSource from '@orbit/indexeddb';
import { backupToMemory } from '../../crud/syncToMemory';
import { MainAPI } from '@model/main-api';
import { createExportCollector } from './exportTableRecs';
const ipc = window?.api as MainAPI;

export async function electronExport(
  exportType: ExportType,
  artifactType: string | null | undefined,
  memory: Memory,
  backup: IndexedDBSource | undefined,
  projectid: number | string,
  userid: number | string,
  nodatamsg: string,
  localizedArtifact: string,
  getOfflineProject: (plan: Plan | VProject | string) => OfflineProject,
  importedDate?: DateTime | undefined,
  target?: string,
  orgWorkflowSteps?: OrgWorkflowStep[],
  sendProgress?: (progress: number | string) => void,
  writingmsg?: string
): Promise<FileResponse | null> {
  const ser = getSerializer(memory);
  const scripturePackage = [ExportType.DBL, ExportType.BURRITO].includes(
    exportType
  );
  const BuildFileResponse = (
    fullpath: string,
    fileName: string,
    buffer: Buffer | undefined,
    changedRecs: number,
    filteredRecs: number
  ): FileResponse => {
    return {
      message: fileName,
      fileURL: 'file:///' + fullpath,
      contentType: 'application/' + exportType,
      buffer: buffer,
      changes: changedRecs,
      filtered: filteredRecs,
      id: '1',
    };
  };

  const idStr = (kind: string, id: number | string) =>
    typeof id === 'number'
      ? id.toString()
      : remoteId(kind, id, memory?.keyMap as RecordKeyMap) || id.split('-')[0];

  const fileName = (
    projRec: ProjectD,
    localizedArtifactType: string,
    suffix: string,
    ext: string
  ) =>
    `APM${idStr('user', userid)}_${idStr(
      'project',
      projRec.id
    )}_${cleanFileName(
      projRec.attributes.name + localizedArtifactType
    )}${cleanFileName(suffix)}.${ext}`;

  const itfb_fileName = (projRec: ProjectD) =>
    new Date().getDate().toString() +
    new Date().getHours().toString() +
    '_' +
    fileName(projRec, '', importedDate?.toISO() ?? '', 'itf');

  const backupName =
    new Date().getDate().toString() +
    new Date().getHours().toString() +
    '_APM' +
    idStr('user', userid) +
    '_backup.' +
    exportType;

  const getProjRec = (projectid: number | string): ProjectD => {
    return findRecord(
      memory,
      'project',
      typeof projectid === 'number'
        ? (remoteIdGuid(
            'project',
            projectid.toString(),
            memory?.keyMap as RecordKeyMap
          ) ?? projectid.toString())
        : projectid
    ) as ProjectD;
  };
  const createZip = async (
    zip: string,
    projRec: ProjectD,
    expType: ExportType
  ) => {
    const AddCheckEntry = async (): Promise<string> => {
      const dt = currentDateTime();
      await ipc?.zipAddFile(
        zip,
        'SILTranscriberOffline',
        dt,
        'Check Format and Date'
      );
      return dt;
    };

    const AddSourceEntry = async (dt: string): Promise<string> => {
      await ipc?.zipAddFile(zip, 'SILTranscriber', dt, 'Imported Date');
      return dt;
    };
    const AddVersionEntry = async (ver: string): Promise<string> => {
      await ipc?.zipAddFile(zip, 'Version', ver, 'IndexedDB Version');
      return ver;
    };
    const AddOfflineEntry = async (): Promise<void> => {
      await ipc?.zipAddFile(zip, 'Offline', '', 'Present if Offline project');
    };
    const AddJsonEntry = async (
      table: string,
      recs: InitializedRecord[],
      sort: string
    ) => {
      //put in the remoteIds for everything, then stringify
      // const ser = projRec?.keys?.remoteId ? onlineSerlzr : offlineSrlzr;
      const resources = projRec?.keys?.remoteId
        ? recs.map((r) => ser.serialize(r))
        : recs.map((r) => {
            const ri = ser.serialize(r);
            ri.id = r.id;
            ri.relationships = r.relationships;
            return ri;
          });
      const json = ![ExportType.AUDIO, ExportType.ELAN].includes(expType)
        ? '{"data":' + JSON.stringify(resources) + '}'
        : JSON.stringify(resources, null, 2);
      await ipc?.zipAddJson(
        zip,
        'data/' + sort + '_' + table + '.json',
        JSON.stringify(json),
        table
      );
    };
    const AddStreamEntry = async (local: string, name: string) => {
      if (
        (await ipc?.exists(local)) &&
        path.dirname(name) !== path.basename(name)
      ) {
        await ipc?.zipAddLocal(
          zip,
          local,
          path.dirname(name),
          path.basename(name)
        );
        return true;
      } else return false;
    };
    const AddUserAvatars = async (recs: InitializedRecord[]) => {
      const avatarpath = PathType.AVATARS + '/';
      for (const u of recs) {
        const user = u as UserD;
        if (
          user?.attributes?.avatarUrl &&
          user.attributes.avatarUrl !== null &&
          user.attributes.avatarUrl !== ''
        ) {
          const dp = await dataPath(
            user.attributes.avatarUrl,
            PathType.AVATARS,
            {
              localname:
                remoteId('user', user.id, memory?.keyMap as RecordKeyMap) +
                (user.attributes?.familyName || '') +
                '.png',
            }
          );
          await AddStreamEntry(dp, avatarpath + path.basename(dp));
        }
      }
    };
    const AddOrgLogos = async (recs: InitializedRecord[]) => {
      const logopath = PathType.LOGOS + '/';
      for (const o of recs) {
        const org = o as Organization;
        if (
          org?.attributes?.logoUrl &&
          org.attributes.logoUrl !== null &&
          org.attributes.logoUrl !== ''
        ) {
          const dp = await dataPath(org.attributes.logoUrl, PathType.LOGOS, {
            localname: org.attributes.slug + '.png',
          });
          await AddStreamEntry(dp, logopath + path.basename(dp));
        }
      }
    };

    const AddMediaFiles = async (
      recs: InitializedRecord[],
      rename: boolean
    ) => {
      const mediapath = PathType.MEDIA + '/';
      let newname = '';
      for (let mx = 0; mx < recs.length; mx++) {
        const mf = recs[mx] as MediaFileD;
        if (mf.attributes?.audioUrl) {
          const mp = await dataPath(mf.attributes.audioUrl, PathType.MEDIA);
          const { fullPath } = await scriptureFullPath(mf, {
            memory,
            scripturePackage,
            projRec,
          } as IExportScripturePath);
          if (rename) newname = mediapath + nameFromTemplate(mf, memory, false);
          else newname = fullPath || mediapath + path.basename(mp);
          await AddStreamEntry(mp, newname);
          if (sendProgress && mx % 50 === 0)
            sendProgress(Math.round((mx * 100) / recs.length));
          if (expType === ExportType.ELAN) {
            const eafCode = getMediaEaf(mf, memory);
            const name = path.basename(newname, path.extname(newname)) + '.eaf';
            await ipc?.zipAddFile(zip, mediapath + name, eafCode, 'EAF');
          }
        }
      }
    };

    const AddFonts = async () => {
      const dir = await dataPath(PathType.FONTS);
      await createFolder(dir);
      const items = await ipc?.readDir(dir);
      for (let i = 0; i < items.length; i++) {
        const fontfile = path.join(dir, items[i]);
        if (await ipc?.exists(fontfile))
          await ipc?.zipAddLocal(zip, fontfile, PathType.FONTS, items[i]);
      }
    };
    const needsRemoteIds = Boolean(projRec?.keys?.remoteId);
    const {
      getTableRecs: GetTableRecs,
      supportingProjects,
      supportingOrgs,
    } = createExportCollector(memory, needsRemoteIds, {
      artifactType,
      target,
      orgWorkflowSteps,
      projRec,
    });

    const AddChanged = async (
      info: fileInfo,
      project: ProjectD | undefined,
      needsRemoteIds: boolean
    ) => {
      const recs = GetTableRecs(info, project, needsRemoteIds);
      let changed = recs;
      if (recs && Array.isArray(recs) && recs.length > 0) {
        changed = recs.filter(
          (u) =>
            u.attributes &&
            DateTime.fromISO(u.attributes.dateUpdated) > imported
        );
        await AddJsonEntry(
          info.table + 's',
          info.table === 'project' ? recs : changed,
          info.sort
        );

        switch (info.table) {
          case 'user':
            await AddUserAvatars(changed);
            break;
          case 'mediafile':
            const newOnly = changed.filter(
              (m) =>
                m.attributes &&
                DateTime.fromISO(m.attributes.dateCreated) > imported
            );
            await AddMediaFiles(newOnly, false);
        }
        return changed.length;
      }
      return 0;
    };
    const AddSupportingProjects = async (project: ProjectD) => {
      let recs = supportingProjects(project);
      const ret = { Added: 0, Filtered: 0 };
      if (recs.length > 0) {
        recs = recs.filter((r) => Boolean(r.keys?.remoteId));
        ret.Added = recs?.length || 0;
      }
      AddJsonEntry('supportingprojects', recs, 'Z');
      const orgs = supportingOrgs(project).filter((o) =>
        Boolean(o.keys?.remoteId)
      );
      if (orgs.length > 0) {
        AddJsonEntry('supportingorgs', orgs, 'Z');
        ret.Added += orgs.length;
      }
      return ret;
    };
    const AddAll = async (
      info: fileInfo,
      project: ProjectD | undefined,
      needsRemoteIds: boolean,
      excludeNew: boolean = false,
      checkRename: boolean = false
    ) => {
      let recs = GetTableRecs(info, project, needsRemoteIds);
      const len = recs?.length || 0;
      const ret = { Added: len, Filtered: 0 };
      if (len > 0) {
        if (needsRemoteIds && excludeNew) {
          recs = recs.filter((r) => Boolean(r.keys?.remoteId));
          ret.Added = recs?.length || 0;
          ret.Filtered = len - ret.Added;
        }
        if (!scripturePackage) {
          AddJsonEntry(info.table + 's', recs, info.sort);
        }
        switch (info.table) {
          case 'organization':
            await AddOrgLogos(recs);
            break;
          case 'user':
            await AddUserAvatars(recs);
            break;
          case 'mediafile':
            await AddMediaFiles(
              recs,
              checkRename &&
                recs.length > 0 &&
                related(recs[0], 'artifactType') === VernacularTag
            );
        }
      }
      return ret;
    };

    const onlyOneProject = (): boolean => {
      const p = memory.cache.query((q) => q.findRecords('project'));
      if (p && Array.isArray(p)) return p.length === 1;
      return true; //should never get here
    };
    let imported: DateTime = DateTime.utc();
    let op: OfflineProject | undefined;
    if (importedDate) {
      imported = importedDate;
    } else {
      op = getOfflineProject(projRec.id);
      // getOfflineProject (useOfflnProjRead.ts) closes over React Orbit data,
      // which can still be empty right after restoreBackup fills memory —
      // fall back to a live memory query for snapshotDate.
      if (!op?.attributes?.snapshotDate) {
        const oprecs = memory.cache.query((q) =>
          q.findRecords('offlineproject')
        ) as OfflineProject[];
        op = oprecs.find((o) => related(o, 'project') === projRec.id) ?? op;
      }
      imported = DateTime.fromISO(
        op?.attributes?.snapshotDate || '1900-01-01T00:00:00.000Z'
      );
      importedDate = imported;
    }

    if (!scripturePackage) {
      await AddSourceEntry(imported.toISO() ?? '');
      await AddVersionEntry((backup?.schema.version || 1).toString());
    } else if (expType === ExportType.BURRITO) {
      const userId =
        remoteIdGuid(
          'user',
          userid.toString(),
          memory?.keyMap as RecordKeyMap
        ) || userid.toString();
      const burritoMetaStr = await getBurritoMeta({
        memory,
        userId,
        projRec,
        scripturePackage,
        artifactType,
        target,
        orgWorkflowSteps,
      } as IBurritoMeta);
      await ipc?.zipAddFile(zip, 'metadata.json', burritoMetaStr, 'metadata');
    }
    if (!needsRemoteIds) await AddOfflineEntry();
    const limit = onlyOneProject() ? undefined : projRec;
    let numRecs = 0;
    let numFiltered = 0;
    switch (expType) {
      case ExportType.ITF:
      case ExportType.ITFBACKUP:
      case ExportType.ITFSYNC:
        const exported = await AddCheckEntry();
        for (const info of updateableFiles) {
          numRecs += await AddChanged(info, limit, needsRemoteIds);
        }
        if (expType !== ExportType.ITFBACKUP && backup) {
          if (!op) op = getOfflineProject(projRec.id);
          if (op && op.attributes) {
            op.attributes.exportedDate = exported;
            await backup.sync((t) => t.updateRecord(op as OfflineProject));
          }
        }
        break;
      case ExportType.DBL:
      case ExportType.BURRITO:
      case ExportType.AUDIO:
      case ExportType.ELAN:
        numRecs += (
          await AddAll(
            { table: 'mediafile', sort: 'H' },
            limit,
            needsRemoteIds,
            false,
            [ExportType.AUDIO, ExportType.ELAN].includes(expType)
          )
        ).Added;
        break;
      default:
        for (const info of updateableFiles) {
          const result = await AddAll(info, limit, needsRemoteIds, true);
          numRecs += result.Added;
          numFiltered += result.Filtered;
        }
        for (const info of staticFiles) {
          await AddAll(info, limit, needsRemoteIds);
        }
        await AddFonts();
        if (limit) {
          const result = await AddSupportingProjects(limit);
          numRecs += result.Added;
          numFiltered += result.Filtered;
        }
    }
    return { zip, numRecs, numFiltered };
  };

  let projects: ProjectD[];
  let backupZip: string | undefined;
  if (
    exportType === ExportType.FULLBACKUP ||
    exportType === ExportType.ITFSYNC
  ) {
    //avoid intermittent errors where projecttype or plan is null
    if (backup) {
      await backupToMemory({ table: 'offlineproject', backup, memory });
      await backupToMemory({ table: 'project', backup, memory });
      await backupToMemory({ table: 'mediafile', backup, memory });
    }

    projects = memory.cache.query((q) =>
      q.findRecords('project')
    ) as ProjectD[];

    // Prefer IndexedDB when present — memory may still be empty if restore
    // has not finished (Go Online race). Fall back to memory otherwise.
    let offlineprojects = (
      backup
        ? await backup.query((q) => q.findRecords('offlineproject'))
        : memory.cache.query((q) => q.findRecords('offlineproject'))
    ) as OfflineProject[];
    if (!Array.isArray(offlineprojects)) offlineprojects = [offlineprojects];
    const ids = offlineprojects
      .filter((o) => o?.attributes?.offlineAvailable)
      .map((o) => related(o, 'project')) as string[];
    projects = projects.filter((p) => ids.includes(p.id));
    backupZip = await ipc?.zipOpen();
    if (exportType === ExportType.FULLBACKUP) {
      exportType = ExportType.PTF;
    } else {
      projects = projects.filter(
        (p) =>
          remoteId('project', p.id, memory?.keyMap as RecordKeyMap) !==
          undefined
      );
      exportType = ExportType.ITF;
    }
  } else {
    projects = [getProjRec(projectid)];
  }
  let changedRecs = 0;
  for (let ix: number = 0; ix < projects.length; ix++) {
    const { zip, numRecs, numFiltered } = await createZip(
      await ipc?.zipOpen(),
      projects[ix],
      exportType
    );
    const filename =
      exportType === ExportType.ITFBACKUP
        ? itfb_fileName(projects[ix])
        : [ExportType.AUDIO, ExportType.BURRITO, ExportType.ELAN].includes(
              exportType
            )
          ? fileName(
              projects[ix],
              `${localizedArtifact}_${exportType}`,
              '',
              'zip'
            )
          : exportType === ExportType.ITF
            ? fileName(
                projects[ix],
                localizedArtifact,
                importedDate?.toISO() ?? '',
                exportType
              )
            : fileName(projects[ix], localizedArtifact, '', exportType);
    changedRecs += numRecs;
    if (backupZip) {
      if (numRecs)
        await ipc?.zipAddZip(
          backupZip,
          filename,
          zip,
          projects[ix].attributes.name
        );
      if (numFiltered) {
        const itf = await createZip(
          await ipc?.zipOpen(),
          projects[ix],
          ExportType.ITF
        );
        await ipc?.zipAddZip(
          backupZip,
          fileName(
            projects[ix],
            localizedArtifact,
            importedDate?.toISO() ?? '',
            ExportType.ITF
          ),
          itf.zip,
          projects[ix].attributes.name
        );
      }
    } else {
      if (numRecs) {
        const where = await dataPath(filename);
        await createPathFolder(where);
        if (sendProgress && writingmsg) sendProgress(writingmsg);
        await ipc?.zipWrite(zip, where);
        await ipc?.zipClose(zip);
        return BuildFileResponse(
          where,
          filename,
          undefined,
          changedRecs,
          numFiltered
        );
      } else if (nodatamsg && projects.length === 1) throw new Error(nodatamsg);
    }
  }
  const backupWhere = await dataPath(backupName);
  await createPathFolder(backupWhere);
  if (backupZip) {
    if (sendProgress && writingmsg) sendProgress(writingmsg);
    await ipc?.zipWrite(backupZip, backupWhere);
  }
  const buffer =
    exportType === ExportType.ITF
      ? await ipc?.zipToBuffer(backupZip as string)
      : undefined;
  await ipc?.zipClose(backupZip as string);
  return BuildFileResponse(
    backupWhere,
    backupName,
    buffer as Buffer,
    changedRecs,
    0
  );
}
