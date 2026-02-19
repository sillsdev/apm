/**
 * Exports project data in PTF format (data/*.json) for use in burrito creation
 * or other contexts. Mirrors the data folder structure from electronExport.
 */
import Memory from '@orbit/memory';
import { getSerializer } from '../../serializers/getSerializer';
import { InitializedRecord, RecordKeyMap } from '@orbit/records';
import {
  related,
  remoteId,
  fileInfo,
  updateableFiles,
  staticFiles,
} from '../../crud';
import {
  ProjectD,
  UserD,
  DiscussionD,
  OrgKeytermD,
  OrgKeytermTargetD,
  IntellectualPropertyD,
  MediaFileD,
  OrganizationD,
  GroupD,
  GroupMembershipD,
  PlanD,
  SectionD,
  PassageD,
  SectionResourceD,
  ArtifactCategoryD,
  SharedResourceD,
} from '../../model';
import { BaseModel, BaseModelD } from '../../model/baseModel';

export interface ProjectDataFiles {
  [filename: string]: string;
}

function serializeRecords(
  recs: InitializedRecord[],
  projRec: ProjectD,
  ser: ReturnType<typeof getSerializer>
): Record<string, unknown>[] {
  return projRec?.keys?.remoteId
    ? (recs.map((r) => ser.serialize(r)) as unknown as Record<
        string,
        unknown
      >[])
    : recs.map((r) => {
        const ri = ser.serialize(r) as unknown as Record<string, unknown>;
        ri.id = r.id;
        ri.relationships = r.relationships;
        return ri;
      });
}

export async function getProjectDataFiles(
  memory: Memory,
  project: ProjectD
): Promise<ProjectDataFiles> {
  const ser = getSerializer(memory);
  const keyMap = memory?.keyMap as RecordKeyMap;
  const needsRemoteIds = Boolean(project?.keys?.remoteId);
  const files: ProjectDataFiles = {};

  const GroupMemberships = (proj: ProjectD) => {
    const groupid = related(proj, 'group');
    return memory.cache.query((q) =>
      q.findRecords('groupmembership').filter({
        relation: 'group',
        record: { type: 'group', id: groupid },
      })
    ) as GroupMembershipD[];
  };

  const Plans = (proj: ProjectD) =>
    memory.cache.query((q) =>
      q.findRecords('plan').filter({
        relation: 'project',
        record: { type: 'project', id: proj.id },
      })
    ) as PlanD[];

  const Sections = (proj: ProjectD) => {
    const plans = Plans(proj).map((pl) => pl.id);
    const allsections = memory.cache.query((q) =>
      q.findRecords('section')
    ) as SectionD[];
    return allsections.filter((s) => plans.includes(related(s, 'plan')));
  };

  const Passages = (proj: ProjectD) => {
    const sections = Sections(proj).map((s) => s.id);
    const passages = memory.cache.query((q) =>
      q.findRecords('passage')
    ) as PassageD[];
    return passages.filter((p) => sections.includes(related(p, 'section')));
  };

  const SectionResources = (proj: ProjectD) => {
    const sections = Sections(proj).map((s) => s.id);
    return (
      memory.cache.query((q) =>
        q.findRecords('sectionresource')
      ) as SectionResourceD[]
    ).filter((r) => sections.includes(related(r, 'section')));
  };

  const HighestByPassage = (media: MediaFileD[]) => {
    const highest: MediaFileD[] = [];
    let psg = '';
    media
      .sort((a, b) =>
        related(a, 'passage') === related(b, 'passage')
          ? a.attributes.versionNumber > b.attributes.versionNumber
            ? 1
            : -1
          : related(a, 'passage') > related(b, 'passage')
            ? 1
            : -1
      )
      .forEach((m) => {
        if (related(m, 'passage') !== psg) {
          highest.push(m);
          psg = related(m, 'passage');
        }
      });
    return highest;
  };

  const SourceMedia = (proj: ProjectD) => {
    const sectionresourcemedia = SectionResources(proj).map(
      (r) => related(r, 'mediafile') as string
    );
    const media = memory.cache.query((q) =>
      q.findRecords('mediafile')
    ) as MediaFileD[];
    const resourcemediafiles = media.filter((m) =>
      sectionresourcemedia.includes(m.id)
    );
    const sourcemediafiles = media.filter(
      (m) =>
        m.attributes?.readyToShare &&
        resourcemediafiles
          .map((r) => related(r, 'resourcePassage'))
          .includes(related(m, 'passage'))
    );
    return HighestByPassage(sourcemediafiles);
  };

  const sharedNotePassageIds = (proj: ProjectD) => {
    const psgs = Passages(proj).filter(
      (p) => related(p, 'sharedResource') !== null
    );
    const sharednotesids = psgs.map(
      (p) => related(p, 'sharedResource') as string
    );
    return (
      memory.cache.query((q) =>
        q.findRecords('sharedresource')
      ) as SharedResourceD[]
    )
      .filter((r) => sharednotesids.includes(r.id))
      .map((r) => related(r, 'passage') as string);
  };

  const sharedNotePassages = (proj: ProjectD) => {
    const ids = sharedNotePassageIds(proj);
    return (
      memory.cache.query((q) => q.findRecords('passage')) as PassageD[]
    ).filter((p) => ids.includes(p.id));
  };

  const sharedNoteSections = (proj: ProjectD) => {
    const sectids = sharedNotePassages(proj).map((p) => related(p, 'section'));
    return (
      memory.cache.query((q) => q.findRecords('section')) as SectionD[]
    ).filter((s) => sectids.includes(s.id));
  };

  const sharedNotePlans = (proj: ProjectD) => {
    const planids = sharedNoteSections(proj).map((p) => related(p, 'plan'));
    return (memory.cache.query((q) => q.findRecords('plan')) as PlanD[]).filter(
      (s) => planids.includes(s.id)
    );
  };

  const sharedNoteProjects = (proj: ProjectD) => {
    const projids = sharedNotePlans(proj).map((p) => related(p, 'project'));
    return (
      memory.cache.query((q) => q.findRecords('project')) as ProjectD[]
    ).filter((s) => projids.includes(s.id));
  };

  const AllMediafiles = (proj: ProjectD) => {
    const media = memory.cache.query((q) =>
      q.findRecords('mediafile')
    ) as MediaFileD[];
    const plans = Plans(proj).map((pl) => pl.id);
    const planmedia = media.filter((m) => plans.includes(related(m, 'plan')));
    const ips = IntellectualProperties(proj, needsRemoteIds).map((i) =>
      related(i, 'releaseMediafile')
    );
    const ipmedia = media.filter((m) => ips.includes(m.id));
    const cats = (
      memory.cache.query((q) =>
        q.findRecords('artifactcategory')
      ) as ArtifactCategoryD[]
    ).filter(
      (a) =>
        related(a, 'organization') === related(proj, 'organization') ||
        related(a, 'organization') === undefined
    );
    const categorymediafiles = media.filter((m) =>
      cats.map((c) => related(c, 'titleMediafile') as string).includes(m.id)
    );
    const orgkeytermtargets = OrgKeyTermTargets(proj, needsRemoteIds).map((i) =>
      related(i, 'mediafile')
    );
    const okttmedia = media.filter((m) => orgkeytermtargets.includes(m.id));
    const sourcemediafiles = SourceMedia(proj);
    const supportingNotePassages = sharedNotePassageIds(proj);
    const sharedmedia = HighestByPassage(
      media.filter((m) =>
        supportingNotePassages.includes(related(m, 'passage'))
      )
    );
    const unique = new Set(
      planmedia
        .concat(ipmedia)
        .concat(okttmedia)
        .concat(categorymediafiles)
        .concat(sourcemediafiles)
        .concat(sharedmedia)
    );
    return FromMedia(Array.from(unique), needsRemoteIds);
  };

  const FromPassages = (
    table: string,
    proj: ProjectD | undefined,
    remoteIds: boolean
  ) => {
    let recs = memory.cache.query((q) => q.findRecords(table)) as (BaseModel &
      InitializedRecord)[];
    if (proj) {
      const passages = Passages(proj).map((p) => p.id);
      recs = recs.filter((rec) => passages.includes(related(rec, 'passage')));
    }
    if (remoteIds) {
      recs.forEach((r) => {
        if (!remoteId(table, r.id, keyMap) && r.attributes)
          r.attributes.offlineId = r.id;
        if (
          table === 'mediafile' &&
          !remoteId('mediafile', related(r, 'sourceMedia'), keyMap)
        ) {
          (r as MediaFileD).attributes.sourceMediaOfflineId = related(
            r,
            'sourceMedia'
          );
        }
      });
    }
    return recs;
  };

  const Discussions = (proj: ProjectD | undefined, remoteIds: boolean) => {
    let ds = memory.cache.query((q) =>
      q.findRecords('discussion')
    ) as DiscussionD[];
    if (proj) {
      const mediafiles = FromPassages('mediafile', proj, remoteIds).map(
        (m) => m.id
      );
      ds = ds.filter((rec) => mediafiles.includes(related(rec, 'mediafile')));
    }
    if (remoteIds) {
      ds.forEach((d) => {
        if (!remoteId('discussion', d.id, keyMap) && d.attributes)
          d.attributes.offlineId = d.id;
        if (!remoteId('mediafile', related(d, 'mediafile'), keyMap))
          d.attributes.offlineMediafileId = related(d, 'mediafile');
      });
    }
    return ds;
  };

  const OrgKeyTerms = (proj: ProjectD | undefined, remoteIds: boolean) => {
    let kts = memory.cache.query((q) =>
      q.findRecords('orgkeyterm')
    ) as OrgKeytermD[];
    kts = kts.filter(
      (r) =>
        Boolean(
          remoteId('organization', related(r, 'organization'), keyMap)
        ) === needsRemoteIds
    );
    if (proj) {
      kts = kts.filter(
        (rec) => related(rec, 'organization') === related(proj, 'organization')
      );
    }
    if (remoteIds) {
      kts.forEach((kt) => {
        if (!remoteId('orgkeyterm', kt.id, keyMap) && kt.attributes)
          kt.attributes.offlineid = kt.id;
      });
    }
    return kts;
  };

  const OrgKeyTermTargets = (
    proj: ProjectD | undefined,
    remoteIds: boolean
  ) => {
    let ktts = memory.cache.query((q) =>
      q.findRecords('orgkeytermtarget')
    ) as OrgKeytermTargetD[];
    ktts = ktts.filter(
      (r) =>
        Boolean(
          remoteId('organization', related(r, 'organization'), keyMap)
        ) === needsRemoteIds
    );
    if (proj) {
      ktts = ktts.filter(
        (rec) => related(rec, 'organization') === related(proj, 'organization')
      );
    }
    if (remoteIds) {
      ktts.forEach((ktt) => {
        if (!remoteId('orgkeytermtarget', ktt.id, keyMap) && ktt.attributes)
          ktt.attributes.offlineId = ktt.id;
        if (
          related(ktt, 'mediafile') &&
          !remoteId('mediafile', related(ktt, 'mediafile'), keyMap)
        )
          ktt.attributes.offlineMediafileId = related(ktt, 'mediafile');
      });
    }
    return ktts;
  };

  const IntellectualProperties = (
    proj: ProjectD | undefined,
    remoteIds: boolean
  ) => {
    let ips = memory.cache.query((q) =>
      q.findRecords('intellectualproperty')
    ) as IntellectualPropertyD[];
    if (proj) {
      ips = ips.filter(
        (rec) => related(rec, 'organization') === related(proj, 'organization')
      );
    }
    if (remoteIds) {
      ips.forEach((ip) => {
        if (!remoteId('intellectualproperty', ip.id, keyMap))
          ip.attributes.offlineId = ip.id;
        if (!remoteId('mediafile', related(ip, 'releaseMediafile'), keyMap))
          ip.attributes.offlineMediafileId = related(ip, 'releaseMediafile');
      });
    }
    return ips;
  };

  const FromMedia = (media: MediaFileD[], remoteIds: boolean) => {
    const copyMedia = media.map((m) => m);
    if (remoteIds) {
      copyMedia.forEach((m) => {
        if (!remoteId('mediafile', m.id, keyMap) && m.attributes) {
          m.attributes.offlineId = m.id;
        }
        const src = related(m, 'sourceMedia');
        if (src && !remoteId('mediafile', src, keyMap) && m.attributes) {
          m.attributes.sourceMediaOfflineId = src;
        }
        delete m.attributes.planId;
        delete m.attributes.artifactTypeId;
        delete m.attributes.passageId;
        delete m.attributes.userId;
        delete m.attributes.recordedbyUserId;
        delete m.attributes.recordedByUserId;
        delete m.attributes.sourceMediaId;
      });
    }
    return copyMedia;
  };

  const Comments = (proj: ProjectD | undefined, remoteIds: boolean) => {
    let comments = memory.cache.query((q) =>
      q.findRecords('comment')
    ) as BaseModelD[];
    if (proj) {
      const discussions = Discussions(proj, remoteIds);
      const discussionIds = discussions.map((d) => d.id);
      comments = comments.filter((rec) =>
        discussionIds.includes(related(rec, 'discussion'))
      );
    }
    if (remoteIds) {
      comments.forEach((c) => {
        if (!remoteId('comment', c.id, keyMap) && c.attributes) {
          c.attributes.offlineId = c.id;
          c.attributes.offlineDiscussionId = related(c, 'discussion');
        }
        if (
          !remoteId('mediafile', related(c, 'mediafile'), keyMap) &&
          c.attributes
        )
          c.attributes.offlineMediafileId = related(c, 'mediafile');
      });
    }
    return comments;
  };

  const defaultQuery = (table: string) =>
    memory.cache.query((q) => q.findRecords(table)) as (BaseModel &
      InitializedRecord)[];

  const GetTableRecs = (
    info: fileInfo,
    proj: ProjectD | undefined,
    needsRemoteIds: boolean
  ): BaseModelD[] => {
    switch (info.table) {
      case 'organization':
        if (proj)
          return [
            memory.cache.query((q) =>
              q.findRecord({
                type: 'organization',
                id: related(proj, 'organization'),
              })
            ) as OrganizationD,
          ];
        return defaultQuery(info.table);

      case 'project':
        if (proj) return [proj];
        return defaultQuery(info.table);

      case 'group':
        if (proj)
          return [
            memory.cache.query((q) =>
              q.findRecord({
                type: 'group',
                id: related(proj, 'group'),
              })
            ) as GroupD,
          ];
        return defaultQuery(info.table);

      case 'groupmembership':
        if (proj) return GroupMemberships(proj);
        return defaultQuery(info.table);

      case 'user':
        if (proj) {
          const projusers = GroupMemberships(proj).map((gm) =>
            related(gm, 'user')
          );
          const users = memory.cache.query((q) =>
            q.findRecords(info.table)
          ) as UserD[];
          return users.filter(
            (u) => projusers.find((p) => p === u.id) !== undefined
          );
        }
        return defaultQuery(info.table);

      case 'plan':
        if (proj) return Plans(proj).concat(sharedNotePlans(proj));
        return defaultQuery(info.table);

      case 'section':
        if (proj) return Sections(proj).concat(sharedNoteSections(proj));
        return defaultQuery(info.table);

      case 'passage':
        if (proj) return Passages(proj).concat(sharedNotePassages(proj));
        return defaultQuery(info.table);

      case 'mediafile':
        if (proj) return AllMediafiles(proj);
        return FromMedia(
          defaultQuery(info.table) as MediaFileD[],
          needsRemoteIds
        );

      case 'passagestatechange':
        return FromPassages(info.table, proj, needsRemoteIds);

      case 'discussion':
        return Discussions(proj, needsRemoteIds);

      case 'comment':
        return Comments(proj, needsRemoteIds);

      case 'projectintegration':
        if (proj)
          return memory.cache.query((q) =>
            q.findRecords(info.table).filter({
              relation: 'project',
              record: { type: 'project', id: proj.id },
            })
          ) as BaseModelD[];
        return defaultQuery(info.table);

      case 'intellectualproperty':
        return IntellectualProperties(proj, needsRemoteIds);

      case 'orgkeyterm':
        return OrgKeyTerms(proj, needsRemoteIds);

      case 'orgkeytermtarget':
        return OrgKeyTermTargets(proj, needsRemoteIds);

      default:
        return defaultQuery(info.table).filter(
          (r) => Boolean(r?.keys?.remoteId) === needsRemoteIds
        );
    }
  };

  const addJsonFile = (
    table: string,
    recs: InitializedRecord[],
    sort: string
  ) => {
    const resources = serializeRecords(recs, project, ser);
    const json = '{"data":' + JSON.stringify(resources) + '}';
    const filename = `data/${sort}_${table}.json`;
    files[filename] = json;
  };

  for (const info of updateableFiles) {
    const recs = GetTableRecs(info, project, needsRemoteIds);
    if (recs?.length > 0) {
      const filtered = needsRemoteIds
        ? recs.filter((r) => Boolean(r?.keys?.remoteId))
        : recs;
      if (filtered.length > 0) {
        addJsonFile(
          info.table + 's',
          info.table === 'project' ? recs : filtered,
          info.sort
        );
      }
    }
  }

  for (const info of staticFiles) {
    const recs = GetTableRecs(info, project, needsRemoteIds);
    if (recs?.length > 0) {
      addJsonFile(info.table + 's', recs, info.sort);
    }
  }

  const supportingProjects = sharedNoteProjects(project).filter((r) =>
    Boolean(r.keys?.remoteId)
  );
  if (supportingProjects.length > 0) {
    addJsonFile('supportingprojects', supportingProjects, 'Z');
  }

  return files;
}
