import Memory from '@orbit/memory';
import { InitializedRecord, RecordKeyMap } from '@orbit/records';
import {
  related,
  remoteId,
  fileInfo,
  mediaArtifacts,
  IExportArtifacts,
} from '../../crud';
import {
  ProjectD,
  UserD,
  DiscussionD,
  MediaFileD,
  OrganizationD,
  GroupD,
  GroupMembershipD,
  PlanD,
  SectionD,
  PassageD,
  ArtifactCategoryD,
  SharedResourceD,
  GraphicD,
  OrgWorkflowStep,
} from '../../model';
import { BaseModel, BaseModelD } from '../../model/baseModel';

export interface ExportCollectorOptions {
  artifactType?: string | null;
  target?: string;
  orgWorkflowSteps?: OrgWorkflowStep[];
  projRec?: ProjectD;
  organizationId?: string;
}

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

  const GroupMemberships = (project: ProjectD) => {
    const groupid = related(project, 'group');
    return memory.cache.query((q) =>
      q.findRecords('groupmembership').filter({
        relation: 'group',
        record: { type: 'group', id: groupid },
      })
    ) as GroupMembershipD[];
  };

  const Plans = (project: ProjectD) =>
    memory.cache.query((q) =>
      q.findRecords('plan').filter({
        relation: 'project',
        record: { type: 'project', id: project.id },
      })
    ) as PlanD[];

  const Sections = (project: ProjectD) => {
    const plans = Plans(project).map((pl) => pl.id);
    const allsections = memory.cache.query((q) =>
      q.findRecords('section')
    ) as SectionD[];
    return allsections.filter((s) => plans.includes(related(s, 'plan')));
  };

  const Passages = (project: ProjectD) => {
    const sections = Sections(project).map((s) => s.id);
    const passages = memory.cache.query((q) =>
      q.findRecords('passage')
    ) as PassageD[];
    return passages.filter((p) => sections.includes(related(p, 'section')));
  };

  const fromIds = (
    table: string,
    rel: string,
    ids?: string[],
    remoteIds?: boolean
  ) => {
    const recs = (
      memory.cache.query((q) => q.findRecords(table)) as BaseModelD[]
    ).filter(
      (r) =>
        (!ids || ids.includes(related(r, rel))) &&
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
      'section',
      project ? Sections(project).map((s) => s.id) : undefined
    );

  const SectionResourceUsers = (project?: ProjectD, remoteIds?: boolean) =>
    fromIds(
      'sectionresourceuser',
      'sectionresource',
      SectionResources(project).map((r) => r.id),
      remoteIds
    );

  const HighestByPassage = (mediafiles: MediaFileD[]) => {
    const highest: MediaFileD[] = [];
    let psg = '';
    mediafiles
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

  const SourceMedia = (project: ProjectD) => {
    const sectionresourcemedia = SectionResources(project).map(
      (r) => related(r, 'mediafile') as string
    );
    const mediafiles = memory.cache.query((q) =>
      q.findRecords('mediafile')
    ) as MediaFileD[];
    const resourcemediafiles = mediafiles.filter((m) =>
      sectionresourcemedia.includes(m.id)
    );
    const sourcemediafiles = mediafiles.filter(
      (m) =>
        m.attributes?.readyToShare &&
        resourcemediafiles
          .map((r) => related(r, 'resourcePassage'))
          .includes(related(m, 'passage'))
    );
    return HighestByPassage(sourcemediafiles);
  };

  const sharedNotePassageIds = (project: ProjectD) => {
    const psgs = Passages(project).filter(
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

  const sharedNotePassages = (project: ProjectD) => {
    const ids = sharedNotePassageIds(project);
    return (
      memory.cache.query((q) => q.findRecords('passage')) as PassageD[]
    ).filter((p) => ids.includes(p.id));
  };

  const SharedResources = (project?: ProjectD, _remoteIds?: boolean) =>
    fromIds(
      'sharedresource',
      'passage',
      project
        ? Passages(project)
            .concat(sharedNotePassages(project))
            .map((p) => p.id)
        : undefined
    );

  const SharedResourceReferences = (project?: ProjectD, _remoteIds?: boolean) =>
    fromIds(
      'sharedresourcereference',
      'sharedResource',
      SharedResources(project).map((r) => r.id)
    );

  const sharedNoteSections = (project: ProjectD) => {
    const sectids = sharedNotePassages(project).map((p) =>
      related(p, 'section')
    );
    return (
      memory.cache.query((q) => q.findRecords('section')) as SectionD[]
    ).filter((s) => sectids.includes(s.id));
  };

  const sharedNotePlans = (project: ProjectD) => {
    const planids = sharedNoteSections(project).map((p) => related(p, 'plan'));
    return (memory.cache.query((q) => q.findRecords('plan')) as PlanD[]).filter(
      (s) => planids.includes(s.id)
    );
  };

  const supportingProjects = (project: ProjectD) => {
    const projids = sharedNotePlans(project).map((p) => related(p, 'project'));
    return (
      memory.cache.query((q) => q.findRecords('project')) as ProjectD[]
    ).filter((s) => projids.includes(s.id));
  };

  const sharedNoteArtifactCategories = (
    project: ProjectD,
    _remoteIds: boolean
  ) => {
    const projOrgId = related(project, 'organization');
    const sharedResources = SharedResources(project) as SharedResourceD[];
    const foreignCatIds = [
      ...new Set(
        sharedResources
          .map((r) => related(r, 'artifactCategory') as string)
          .filter(Boolean)
      ),
    ];
    if (foreignCatIds.length === 0) return [] as ArtifactCategoryD[];
    return (
      memory.cache.query((q) =>
        q.findRecords('artifactcategory')
      ) as ArtifactCategoryD[]
    ).filter(
      (a) =>
        foreignCatIds.includes(a.id) &&
        related(a, 'organization') !== projOrgId &&
        Boolean(remoteId('organization', related(a, 'organization'), km)) ===
          needsRemoteIds
    );
  };

  const supportingOrgs = (project: ProjectD) => {
    const projOrgId = related(project, 'organization');
    const cats = sharedNoteArtifactCategories(project, needsRemoteIds);
    const orgIds = [
      ...new Set(
        cats
          .map((c) => related(c, 'organization'))
          .concat(
            supportingProjects(project).map((p) => related(p, 'organization'))
          )
          .filter((id) => id && id !== projOrgId)
      ),
    ];
    return (
      memory.cache.query((q) =>
        q.findRecords('organization')
      ) as OrganizationD[]
    ).filter(
      (o) =>
        orgIds.includes(o.id) &&
        Boolean(remoteId('organization', o.id, km)) === needsRemoteIds
    );
  };

  const orgTable = (
    table: string,
    project: ProjectD | undefined,
    remoteIds: boolean,
    {
      rel = 'organization',
      mediafile,
    }: { rel?: string; mediafile?: string } = {}
  ) => {
    const scopeId =
      rel === 'project'
        ? project?.id
        : (options?.organizationId ??
          (project ? related(project, 'organization') : undefined));
    let recs = (
      memory.cache.query((q) => q.findRecords(table)) as BaseModelD[]
    ).filter(
      (r) => Boolean(remoteId(rel, related(r, rel), km)) === needsRemoteIds
    );
    if (scopeId) recs = recs.filter((rec) => related(rec, rel) === scopeId);
    if (remoteIds) {
      recs.forEach((r) => {
        if (!remoteId(table, r.id, km) && r.attributes)
          Object.assign(r.attributes, { offlineId: r.id });
        const mid = mediafile ? related(r, mediafile) : '';
        if (mid && !remoteId('mediafile', mid, km) && r.attributes)
          Object.assign(r.attributes, { offlineMediafileId: mid });
      });
    }
    return recs;
  };

  const ArtifactCategories = (
    project: ProjectD | undefined,
    remoteIds: boolean
  ) => {
    const cats = orgTable('artifactcategory', project, remoteIds);
    if (!project) return cats;
    const globals = (
      memory.cache.query((q) =>
        q.findRecords('artifactcategory')
      ) as ArtifactCategoryD[]
    ).filter((a) => {
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
    const recs = orgTable('graphic', project, remoteIds) as GraphicD[];
    const sections = project
      ? Sections(project).concat(sharedNoteSections(project))
      : (memory.cache.query((q) => q.findRecords('section')) as SectionD[]);
    const passages = project
      ? Passages(project).concat(sharedNotePassages(project))
      : (memory.cache.query((q) => q.findRecords('passage')) as PassageD[]);
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
      'organizationscheme',
      orgTable('organizationscheme', project, remoteIds).map((s) => s.id)
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

  const AllMediafiles = (project: ProjectD) => {
    const mediafiles = memory.cache.query((q) =>
      q.findRecords('mediafile')
    ) as MediaFileD[];
    const plans = Plans(project).map((pl) => pl.id);
    const planmedia = mediafiles.filter((m) =>
      plans.includes(related(m, 'plan'))
    );
    const ip = orgTable('intellectualproperty', project, needsRemoteIds, {
      mediafile: 'releaseMediafile',
    }).map((i) => related(i, 'releaseMediafile'));
    const ipmedia = mediafiles.filter((m) => ip.includes(m.id));
    const catTitleIds = ArtifactCategories(project, needsRemoteIds).map(
      (c) => related(c, 'titleMediafile') as string
    );
    const categorymediafiles = mediafiles.filter((m) =>
      catTitleIds.includes(m.id)
    );
    const orgkeytermtargets = orgTable(
      'orgkeytermtarget',
      project,
      needsRemoteIds,
      { mediafile: 'mediafile' }
    ).map((i) => related(i, 'mediafile'));
    const okttmedia = mediafiles.filter((m) =>
      orgkeytermtargets.includes(m.id)
    );
    const graphicmedia = Graphics(project, needsRemoteIds).map((g) =>
      related(g, 'mediafile')
    );
    const grmedia = mediafiles.filter((m) => graphicmedia.includes(m.id));
    const sourcemediafiles = SourceMedia(project);
    const supportingNotePassages = sharedNotePassageIds(project);
    const sharedmedia = HighestByPassage(
      mediafiles.filter((m) =>
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
        .concat(grmedia)
    );
    return FromMedia(Array.from(unique), needsRemoteIds);
  };

  const FromPassages = (
    table: string,
    project: ProjectD | undefined,
    remoteIds: boolean
  ) => {
    let recs = memory.cache.query((q) => q.findRecords(table)) as (BaseModel &
      InitializedRecord)[];
    if (project) {
      const passages = Passages(project).map((p) => p.id);
      recs = recs.filter((rec) => passages.includes(related(rec, 'passage')));
    }
    if (remoteIds) {
      recs.forEach((r) => {
        if (!remoteId(table, r.id, km) && r.attributes)
          r.attributes.offlineId = r.id;
        if (
          table === 'mediafile' &&
          !remoteId('mediafile', related(r, 'sourceMedia'), km)
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

  const Discussions = (project: ProjectD | undefined, remoteIds: boolean) => {
    let ds = memory.cache.query((q) =>
      q.findRecords('discussion')
    ) as DiscussionD[];
    if (project) {
      const mediafiles = FromPassages('mediafile', project, remoteIds).map(
        (m) => m.id
      );
      ds = ds.filter((rec) => mediafiles.includes(related(rec, 'mediafile')));
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
    let comments = memory.cache.query((q) =>
      q.findRecords('comment')
    ) as BaseModelD[];
    if (project) {
      const discussions = Discussions(project, remoteIds);
      const discussionIds = discussions.map((d) => d.id);
      comments = comments.filter((rec) =>
        discussionIds.includes(related(rec, 'discussion'))
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
    memory.cache.query((q) => q.findRecords(table)) as (BaseModel &
      InitializedRecord)[];

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
        if (project)
          return [
            memory.cache.query((q) =>
              q.findRecord({ type: 'group', id: related(project, 'group') })
            ) as GroupD,
          ];
        return defaultQuery(info.table);

      case 'groupmembership':
        if (project) return GroupMemberships(project);
        return defaultQuery(info.table);

      case 'user':
        if (project) {
          const projusers = GroupMemberships(project).map((gm) =>
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
        if (project) return Plans(project).concat(sharedNotePlans(project));
        return defaultQuery(info.table);

      case 'section':
        if (project)
          return Sections(project).concat(sharedNoteSections(project));
        return defaultQuery(info.table);

      case 'passage':
        if (project)
          return Passages(project).concat(sharedNotePassages(project));
        return defaultQuery(info.table);

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
          const ipIds = orgTable('intellectualproperty', undefined, remoteIds, {
            mediafile: 'releaseMediafile',
          }).map((i) => related(i, 'releaseMediafile'));
          const mediafiles = (defaultQuery('mediafile') as MediaFileD[]).filter(
            (m) => ipIds.includes(m.id)
          );
          return FromMedia(mediafiles, remoteIds);
        }
        return FromMedia(defaultQuery(info.table) as MediaFileD[], remoteIds);

      case 'passagestatechange':
        return FromPassages(info.table, project, remoteIds);

      case 'discussion':
        return Discussions(project, remoteIds);

      case 'comment':
        return Comments(project, remoteIds);

      case 'projectintegration':
        if (project)
          return memory.cache.query((q) =>
            q.findRecords(info.table).filter({
              relation: 'project',
              record: { type: 'project', id: project.id },
            })
          ) as BaseModelD[];
        return defaultQuery(info.table);

      case 'intellectualproperty':
        return orgTable('intellectualproperty', project, remoteIds, {
          mediafile: 'releaseMediafile',
        });

      case 'orgkeyterm':
        return orgTable('orgkeyterm', project, remoteIds);

      case 'orgkeytermtarget':
        return orgTable('orgkeytermtarget', project, remoteIds, {
          mediafile: 'mediafile',
        });
      case 'orgkeytermreference':
        return orgTable('orgkeytermreference', project, remoteIds, {
          rel: 'project',
        });
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
        if (project) {
          const orgBibleIds = orgTable(
            'organizationbible',
            project,
            remoteIds
          ).map((ob) => related(ob, 'bible'));
          return defaultQuery('bible').filter(
            (b) =>
              orgBibleIds.includes(b.id) &&
              Boolean(b?.keys?.remoteId) === needsRemoteIds
          );
        }
        return defaultQuery(info.table).filter(
          (r) => Boolean(r?.keys?.remoteId) === needsRemoteIds
        );

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
