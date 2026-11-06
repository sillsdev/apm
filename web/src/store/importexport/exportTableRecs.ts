import Memory from '@orbit/memory';
import {
  InitializedRecord,
  RecordKeyMap,
  RecordRelationship,
} from '@orbit/records';
import {
  related,
  remoteId,
  fileInfo,
  mediaArtifacts,
  IExportArtifacts,
} from '../../crud';
import {
  ArtifactCategoryD,
  MediaFileD,
  OrganizationD,
  OrgWorkflowStep,
  PassageD,
  ProjectD,
} from '../../model';
import { BaseModel, BaseModelD } from '../../model/baseModel';
import { mediaReplacementsForPlans } from '../../crud/mediaReplacementsForPlans';
import type { RecordByType } from '../../model/recordByType';
import { findRecords } from '../../crud/tryFindRecord';

export interface ExportCollectorOptions {
  artifactType?: string | null;
  target?: string;
  orgWorkflowSteps?: OrgWorkflowStep[];
  projRec?: ProjectD;
  organizationId?: string;
}

// related() is any. A to-one organization link is the id; null is no org.
const organizationOf = (r: {
  relationships?: { organization: RecordRelationship };
}) => related(r, 'organization') as string;

type OrgTable = {
  [K in keyof RecordByType]: RecordByType[K] extends {
    relationships?: { organization: RecordRelationship };
  }
    ? K
    : never;
}[keyof RecordByType];

export interface ExportCollector {
  getTableRecs: (
    info: fileInfo,
    project: ProjectD | undefined,
    needsRemoteIds: boolean
  ) => BaseModelD[];
  supportingProjects: (project: ProjectD) => ProjectD[];
  supportingOrgs: (project: ProjectD) => OrganizationD[];
}

export function createExportCollector(
  memory: Memory,
  needsRemoteIds: boolean,
  options?: ExportCollectorOptions
): ExportCollector {
  const km = memory?.keyMap as RecordKeyMap;

  const Groups = (project: ProjectD) => {
    const orgId = related(project, 'organization');
    return findRecords(memory, 'group').filter(
      (g) =>
        related(g, 'owner') === orgId &&
        Boolean(g?.keys?.remoteId) === needsRemoteIds
    );
  };

  const GroupMemberships = (project: ProjectD) => {
    const groupIds = new Set(Groups(project).map((g) => g.id));
    return findRecords(memory, 'groupmembership').filter((gm) =>
      groupIds.has(related(gm, 'group'))
    );
  };

  const Plans = (project: ProjectD) =>
    findRecords(memory, 'plan').filter(
      (pl) => related(pl, 'project') === project.id
    );

  const Sections = (project: ProjectD) => {
    const plans = new Set(Plans(project).map((pl) => pl.id));
    const allsections = findRecords(memory, 'section');
    return allsections.filter((s) => plans.has(related(s, 'plan')));
  };

  const Passages = (project: ProjectD) => {
    const sections = new Set(Sections(project).map((s) => s.id));
    const passages = findRecords(memory, 'passage');
    return passages.filter((p) => sections.has(related(p, 'section')));
  };

  const fromIds = <Table extends keyof RecordByType>(
    table: Table,
    relatedId: (r: RecordByType[Table]) => string,
    ids?: Set<string>,
    remoteIds?: boolean
  ) => {
    const recs = findRecords(memory, table).filter(
      (r) =>
        (!ids || ids.has(relatedId(r))) &&
        Boolean(r?.keys?.remoteId) === needsRemoteIds
    );
    if (remoteIds) {
      recs.forEach((r) => {
        if (!remoteId(table, r.id, km) && r.attributes)
          Object.assign(r.attributes, { offlineId: r.id });
      });
    }
    return recs;
  };

  const SectionResources = (project?: ProjectD, _remoteIds?: boolean) =>
    fromIds(
      'sectionresource',
      (r) => related(r, 'section'),
      project ? new Set(Sections(project).map((s) => s.id)) : undefined
    );

  const SectionResourceUsers = (project?: ProjectD, remoteIds?: boolean) =>
    fromIds(
      'sectionresourceuser',
      (r) => related(r, 'sectionresource'),
      new Set(SectionResources(project).map((r) => r.id)),
      remoteIds
    );

  const HighestByPassage = (mediafiles: MediaFileD[]) => {
    const highest: MediaFileD[] = [];
    let psg = '';
    mediafiles
      .sort((a, b) =>
        related(a, 'passage') === related(b, 'passage')
          ? b.attributes.versionNumber - a.attributes.versionNumber
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

  const SourceMedia = (project: ProjectD) => {
    const sectionresourcemedia = new Set(
      SectionResources(project).map((r) => related(r, 'mediafile') as string)
    );
    const mediafiles = findRecords(memory, 'mediafile');
    const resourcemediafiles = mediafiles.filter((m) =>
      sectionresourcemedia.has(m.id)
    );
    const sourcePassageLocalIds = new Set(
      resourcemediafiles.map((r) => related(r, 'resourcePassage'))
    );
    const sourcePassageRemoteIds = new Set(
      resourcemediafiles
        .map((r) => r.attributes?.resourcePassageId)
        .filter((id): id is number => typeof id === 'number' && id > 0)
        .map(String)
    );
    const sourcemediafiles = mediafiles.filter((m) => {
      if (!m.attributes?.readyToShare) return false;
      const psg = related(m, 'passage');
      if (sourcePassageLocalIds.has(psg)) return true;
      const rem = remoteId('passage', psg, km);
      return Boolean(rem) && sourcePassageRemoteIds.has(String(rem));
    });
    return HighestByPassage(sourcemediafiles);
  };

  const sharedNotePassageIds = (project: ProjectD): Set<string> => {
    const psgs = Passages(project).filter(
      (p) => related(p, 'sharedResource') !== null
    );
    const sharednotesids = new Set(
      psgs.map((p) => related(p, 'sharedResource') as string)
    );
    return new Set<string>(
      findRecords(memory, 'sharedresource')
        .filter((r) => sharednotesids.has(r.id))
        .map((r) => related(r, 'passage') as string)
    );
  };

  const sharedNotePassages = (project: ProjectD): PassageD[] => {
    const ids = sharedNotePassageIds(project);
    return findRecords(memory, 'passage').filter((p) => ids.has(p.id));
  };

  const SharedResources = (project?: ProjectD, _remoteIds?: boolean) =>
    fromIds(
      'sharedresource',
      (r) => related(r, 'passage'),
      project
        ? new Set(
            Passages(project)
              .concat(sharedNotePassages(project))
              .map((p) => p.id)
          )
        : undefined
    );

  const SharedResourceReferences = (project?: ProjectD, _remoteIds?: boolean) =>
    fromIds(
      'sharedresourcereference',
      (r) => related(r, 'sharedResource'),
      new Set(SharedResources(project).map((r) => r.id))
    );

  const sharedNoteSections = (project: ProjectD) => {
    const sectids = new Set(
      sharedNotePassages(project).map((p) => related(p, 'section'))
    );
    return findRecords(memory, 'section').filter((s) => sectids.has(s.id));
  };

  const sharedNoteArtifactCategories = (
    project: ProjectD,
    _remoteIds: boolean
  ) => {
    const projOrgId = related(project, 'organization');
    const sharedResources = SharedResources(project);
    const foreignCatIds: Set<string> = new Set(
      sharedResources
        .map((r) => related(r, 'artifactCategory') as string)
        .filter(Boolean)
    );
    if (foreignCatIds.size === 0) return [] as ArtifactCategoryD[];
    return findRecords(memory, 'artifactcategory').filter((a) => {
      const org = related(a, 'organization');
      return (
        foreignCatIds.has(a.id) &&
        Boolean(org) &&
        org !== projOrgId &&
        Boolean(remoteId('organization', org, km)) === needsRemoteIds
      );
    });
  };

  const supportingOrgs = (project: ProjectD) => {
    const projOrgId = related(project, 'organization');
    const cats = sharedNoteArtifactCategories(project, needsRemoteIds);
    const orgIds = new Set(
      cats
        .map((c) => related(c, 'organization'))
        .concat(
          supportingProjects(project).map((p) => related(p, 'organization'))
        )
        .filter((id) => id && id !== projOrgId)
    );
    return findRecords(memory, 'organization').filter(
      (o) =>
        orgIds.has(o.id) &&
        Boolean(remoteId('organization', o.id, km)) === needsRemoteIds
    );
  };

  const orgTable = <Table extends OrgTable>(
    table: Table,
    project: ProjectD | undefined,
    remoteIds: boolean,
    { mediaId }: { mediaId?: (r: RecordByType[Table]) => string } = {}
  ) => {
    const scopeId =
      options?.organizationId ??
      (project ? related(project, 'organization') : undefined);
    let recs = findRecords(memory, table).filter((r) => {
      const id = organizationOf(r);
      return (
        Boolean(id) &&
        Boolean(remoteId('organization', id, km)) === needsRemoteIds
      );
    });
    if (scopeId) recs = recs.filter((rec) => organizationOf(rec) === scopeId);
    if (remoteIds) {
      recs.forEach((r) => {
        if (!remoteId(table, r.id, km) && r.attributes)
          Object.assign(r.attributes, { offlineId: r.id });
        const mid = mediaId?.(r) ?? '';
        if (mid && !remoteId('mediafile', mid, km) && r.attributes)
          Object.assign(r.attributes, { offlineMediafileId: mid });
      });
    }
    return recs;
  };

  const intellectualProperties = (
    project: ProjectD | undefined,
    remoteIds: boolean
  ) =>
    orgTable('intellectualproperty', project, remoteIds, {
      mediaId: (i) => related(i, 'releaseMediafile'),
    });

  const releaseMediafileIds = (
    project: ProjectD | undefined,
    remoteIds: boolean
  ) =>
    new Set(
      intellectualProperties(project, remoteIds).map((i) =>
        related(i, 'releaseMediafile')
      )
    );

  const Bibles = (project?: ProjectD) => {
    const recs = findRecords(memory, 'bible');
    const ids = project
      ? new Set(
          orgTable('organizationbible', project, needsRemoteIds).map((ob) =>
            related(ob, 'bible')
          )
        )
      : undefined;
    return recs.filter(
      (b) =>
        (!ids || ids.has(b.id)) && Boolean(b?.keys?.remoteId) === needsRemoteIds
    );
  };

  const ArtifactCategories = (
    project: ProjectD | undefined,
    remoteIds: boolean
  ) => {
    const cats = orgTable('artifactcategory', project, remoteIds);
    if (!project) return cats;
    const globals = findRecords(memory, 'artifactcategory').filter((a) => {
      const org = related(a, 'organization');
      return (
        (org === null || org === undefined) &&
        Boolean(a?.keys?.remoteId) === needsRemoteIds
      );
    });
    if (remoteIds) {
      globals.forEach((r) => {
        if (!remoteId('artifactcategory', r.id, km) && r.attributes)
          Object.assign(r.attributes, { offlineId: r.id });
      });
    }
    const seen = new Set(cats.map((c) => c.id));
    return cats.concat(
      globals
        .concat(sharedNoteArtifactCategories(project, remoteIds))
        .filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        })
    );
  };

  const Graphics = (project: ProjectD | undefined, remoteIds: boolean) => {
    const recs = orgTable('graphic', project, remoteIds);
    const sections = project
      ? Sections(project).concat(sharedNoteSections(project))
      : findRecords(memory, 'section');
    const passages = project
      ? Passages(project).concat(sharedNotePassages(project))
      : findRecords(memory, 'passage');
    const remoteNums = (kind: string, rows: { id: string }[]) =>
      new Set(
        rows
          .map((r) => parseInt(remoteId(kind, r.id, km) ?? '', 10))
          .filter((n) => !Number.isNaN(n))
      );
    const sectionIds = remoteNums('section', sections);
    const passageIds = remoteNums('passage', passages);
    return recs.filter((g) => {
      const t = g.attributes?.resourceType;
      const id = g.attributes?.resourceId;
      return (
        t === 'category' ||
        (t === 'section' && sectionIds.has(id)) ||
        (t === 'passage' && passageIds.has(id))
      );
    });
  };

  const OrganizationSchemeSteps = (
    project: ProjectD | undefined,
    remoteIds: boolean
  ) =>
    fromIds(
      'organizationschemestep',
      (r) => related(r, 'organizationscheme'),
      new Set(
        orgTable('organizationscheme', project, remoteIds).map((s) => s.id)
      )
    );

  const FromMedia = (mediafiles: MediaFileD[], remoteIds: boolean) => {
    if (remoteIds) {
      mediafiles.forEach((m) => {
        if (!remoteId('mediafile', m.id, km) && m.attributes) {
          m.attributes.offlineId = m.id;
        }
        const src = related(m, 'sourceMedia');
        if (src && !remoteId('mediafile', src, km) && m.attributes) {
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
    return mediafiles;
  };

  const PlanMedia = (project: ProjectD) => {
    const plans = new Set(Plans(project).map((pl) => pl.id));
    return findRecords(memory, 'mediafile').filter((m) =>
      plans.has(related(m, 'plan'))
    );
  };

  const AllMediafiles = (project: ProjectD) => {
    const mediafiles = findRecords(memory, 'mediafile');
    const planmedia = PlanMedia(project);
    const ip = releaseMediafileIds(project, needsRemoteIds);
    const ipmedia = mediafiles.filter((m) => ip.has(m.id));
    const catTitleIds = new Set(
      ArtifactCategories(project, needsRemoteIds).map(
        (c) => related(c, 'titleMediafile') as string
      )
    );
    const categorymediafiles = mediafiles.filter((m) => catTitleIds.has(m.id));
    const orgkeytermtargets = new Set(
      orgTable('orgkeytermtarget', project, needsRemoteIds, {
        mediaId: (i) => related(i, 'mediafile'),
      }).map((i) => related(i, 'mediafile'))
    );
    const okttmedia = mediafiles.filter((m) => orgkeytermtargets.has(m.id));
    const graphicMediaIds = new Set(
      findRecords(memory, 'graphic')
        .map((g) => related(g, 'mediafile') as string)
        .filter(Boolean)
    );
    const bibleMediaIds = new Set(
      Bibles(project)
        .flatMap((b) => [
          related(b, 'bibleMediafile'),
          related(b, 'isoMediafile'),
        ])
        .filter(Boolean)
    );
    const biblemedia = mediafiles.filter((m) => bibleMediaIds.has(m.id));
    const sourcemediafiles = SourceMedia(project);
    const supportingNotePassages = sharedNotePassageIds(project);
    const sharedmedia = HighestByPassage(
      mediafiles.filter((m) =>
        supportingNotePassages.has(related(m, 'passage'))
      )
    );
    const unique = new Set(
      planmedia
        .concat(ipmedia)
        .concat(okttmedia)
        .concat(categorymediafiles)
        .concat(sourcemediafiles)
        .concat(sharedmedia)
        .concat(biblemedia)
        .filter((m) => !graphicMediaIds.has(m.id))
    );
    return FromMedia(Array.from(unique), needsRemoteIds);
  };

  const supportingPlans = (project: ProjectD) => {
    const ownIds = new Set(Plans(project).map((p) => p.id));
    const planIds = new Set(
      AllMediafiles(project)
        .map((m) => related(m, 'plan'))
        .filter((id) => id && !ownIds.has(id))
    );
    return findRecords(memory, 'plan').filter((p) => planIds.has(p.id));
  };

  const supportingProjects = (project: ProjectD) => {
    const projids = new Set(
      supportingPlans(project)
        .map((p) => related(p, 'project'))
        .filter((id) => id && id !== project.id)
    );
    return findRecords(memory, 'project').filter((s) => projids.has(s.id));
  };

  const PassageStateChanges = (
    project: ProjectD | undefined,
    remoteIds: boolean
  ) => {
    let recs = findRecords(memory, 'passagestatechange');
    if (project) {
      const passages = new Set(Passages(project).map((p) => p.id));
      recs = recs.filter((rec) => passages.has(related(rec, 'passage')));
    }
    if (remoteIds) {
      recs.forEach((r) => {
        if (!remoteId('passagestatechange', r.id, km) && r.attributes)
          r.attributes.offlineId = r.id;
      });
    }
    return recs;
  };

  const Discussions = (project: ProjectD | undefined, remoteIds: boolean) => {
    let ds = findRecords(memory, 'discussion');
    if (project) {
      const mediafiles = new Set(PlanMedia(project).map((m) => m.id));
      ds = ds.filter((rec) => mediafiles.has(related(rec, 'mediafile')));
    }
    if (remoteIds) {
      ds.forEach((d) => {
        if (!remoteId('discussion', d.id, km) && d.attributes)
          d.attributes.offlineId = d.id;
        if (!remoteId('mediafile', related(d, 'mediafile'), km))
          d.attributes.offlineMediafileId = related(d, 'mediafile');
      });
    }
    return ds;
  };

  const Comments = (project: ProjectD | undefined, remoteIds: boolean) => {
    let comments = findRecords(memory, 'comment');
    if (project) {
      const discussions = Discussions(project, remoteIds);
      const discussionIds = new Set(discussions.map((d) => d.id));
      comments = comments.filter((rec) =>
        discussionIds.has(related(rec, 'discussion'))
      );
    }
    if (remoteIds) {
      comments.forEach((c) => {
        if (!remoteId('comment', c.id, km) && c.attributes) {
          c.attributes.offlineId = c.id;
          c.attributes.offlineDiscussionId = related(c, 'discussion');
        }
        if (!remoteId('mediafile', related(c, 'mediafile'), km) && c.attributes)
          c.attributes.offlineMediafileId = related(c, 'mediafile');
      });
    }
    return comments;
  };

  const defaultQuery = (table: string) =>
    findRecords(memory, table) as (BaseModel & InitializedRecord)[];

  const getTableRecs = (
    info: fileInfo,
    project: ProjectD | undefined,
    remoteIds: boolean
  ): BaseModelD[] => {
    switch (info.table) {
      case 'organization':
        if (project)
          return [
            memory.cache.query((q) =>
              q.findRecord({
                type: 'organization',
                id: related(project, 'organization'),
              })
            ) as OrganizationD,
          ];
        return defaultQuery(info.table);

      case 'project':
        if (project) return [project];
        return defaultQuery(info.table);

      case 'group':
        if (project) return Groups(project);
        return defaultQuery(info.table);

      case 'groupmembership':
        if (project) return GroupMemberships(project);
        return defaultQuery(info.table);

      case 'user':
        if (project) {
          const projusers = GroupMemberships(project).map((gm) =>
            related(gm, 'user')
          );
          const users = findRecords(memory, 'user');
          return users.filter(
            (u) => projusers.find((p) => p === u.id) !== undefined
          );
        }
        return defaultQuery(info.table);

      case 'plan':
        if (project) return Plans(project).concat(supportingPlans(project));
        return defaultQuery(info.table);

      case 'section':
        if (project)
          return Sections(project).concat(sharedNoteSections(project));
        return defaultQuery(info.table);

      case 'passage':
        if (project)
          return Passages(project).concat(sharedNotePassages(project));
        return defaultQuery(info.table);

      case 'mediareplacement':
        return mediaReplacementsForPlans(
          memory,
          project ? Plans(project).map((pl) => pl.id) : undefined
        );

      case 'mediafile':
        if (options?.artifactType !== undefined && options.projRec) {
          const mediafiles = mediaArtifacts({
            memory,
            projRec: options.projRec,
            artifactType: options.artifactType,
            target: options.target,
            orgWorkflowSteps: options.orgWorkflowSteps,
          } as IExportArtifacts);
          if (mediafiles) return FromMedia(mediafiles, remoteIds);
        }
        if (project) return AllMediafiles(project);
        if (options?.organizationId) {
          const ipIds = releaseMediafileIds(undefined, remoteIds);
          const mediafiles = findRecords(memory, 'mediafile').filter((m) =>
            ipIds.has(m.id)
          );
          return FromMedia(mediafiles, remoteIds);
        }
        return FromMedia(findRecords(memory, 'mediafile'), remoteIds);

      case 'passagestatechange':
        return PassageStateChanges(project, remoteIds);

      case 'discussion':
        return Discussions(project, remoteIds);

      case 'comment':
        return Comments(project, remoteIds);

      case 'projectintegration':
        if (project)
          return findRecords(memory, 'projectintegration').filter(
            (row) => related(row, 'project') === project.id
          );
        return defaultQuery(info.table);

      case 'intellectualproperty':
        return intellectualProperties(project, remoteIds);

      case 'orgkeyterm':
        return orgTable('orgkeyterm', project, remoteIds);

      case 'orgkeytermtarget':
        return orgTable('orgkeytermtarget', project, remoteIds, {
          mediaId: (i) => related(i, 'mediafile'),
        });
      case 'orgkeytermreference':
        return fromIds(
          'orgkeytermreference',
          (r) => related(r, 'orgkeyterm'),
          new Set(orgTable('orgkeyterm', project, remoteIds).map((t) => t.id)),
          remoteIds
        );
      case 'sectionresourceuser':
        return SectionResourceUsers(project, remoteIds);
      case 'organizationscheme':
        return orgTable('organizationscheme', project, remoteIds);
      case 'organizationschemestep':
        return OrganizationSchemeSteps(project, remoteIds);
      case 'graphic':
        return Graphics(project, remoteIds);
      case 'organizationmembership':
        return orgTable('organizationmembership', project, remoteIds);
      case 'orgworkflowstep':
        return orgTable('orgworkflowstep', project, remoteIds);
      case 'sectionresource':
        return SectionResources(project, remoteIds);
      case 'sharedresource':
        return SharedResources(project, remoteIds);
      case 'sharedresourcereference':
        return SharedResourceReferences(project, remoteIds);
      case 'artifactcategory':
        return ArtifactCategories(project, remoteIds);

      case 'organizationbible':
        return orgTable('organizationbible', project, remoteIds);

      case 'bible':
        return Bibles(project);

      case 'activitystate':
      case 'artifacttype':
      case 'integration':
      case 'passagetype':
      case 'plantype':
      case 'projecttype':
      case 'role':
      case 'workflowstep':
        return defaultQuery(info.table).filter(
          (r) => Boolean(r?.keys?.remoteId) === needsRemoteIds
        );
      case 'invitation':
        return [];
      default:
        throw new Error(`GetTableRecs: unhandled table '${info.table}'`);
    }
  };

  return { getTableRecs, supportingProjects, supportingOrgs };
}
