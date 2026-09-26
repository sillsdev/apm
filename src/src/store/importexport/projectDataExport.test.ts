import type Memory from '@orbit/memory';
import type { ProjectD } from '../../model';
import { related } from '../../crud/related';

jest.mock('../../serializers/getSerializer', () => ({
  getSerializer: () => ({
    serialize: (r: { type: string; id: string; attributes?: unknown }) => ({
      type: r.type,
      id: r.id,
      attributes: r.attributes,
    }),
  }),
}));

jest.mock('../../crud', () => ({
  related: jest.requireActual('../../crud/related').related,
  remoteId: jest.requireActual('../../crud/remoteId').remoteId,
  updateableFiles: jest.requireActual('../../crud/fileOrder').updateableFiles,
  staticFiles: jest.requireActual('../../crud/fileOrder').staticFiles,
  mediaArtifacts: jest.fn(),
}));

import { getProjectDataFiles } from './projectDataExport';
import { createExportCollector } from './exportTableRecs';

const rel = (type: string, id: string) => ({ data: { type, id } });

const orgRec = (id: string, name: string, keyed = true) => ({
  type: 'organization',
  id,
  ...(keyed ? { keys: { remoteId: id } } : {}),
  attributes: {
    name,
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  },
  relationships: {},
});

const orgScoped = (type: string, id: string, orgId: string, keyed = true) => ({
  type,
  id,
  ...(keyed ? { keys: { remoteId: id } } : {}),
  attributes: {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  },
  relationships: { organization: rel('organization', orgId) },
});

function memoryStub(store: Record<string, unknown[]>): Memory {
  return {
    schema: {},
    keyMap: {
      idToKey: (table: string, _key: string, localId: string) => {
        if (localId == null)
          throw new Error(`idToKey called without localId (${table})`);
        const rec = (
          (store[table] ?? []) as { id: string; keys?: { remoteId?: string } }[]
        ).find((r) => r.id === localId);
        return rec?.keys?.remoteId;
      },
    },
    cache: {
      query: (cb: (q: unknown) => unknown) => {
        const q = {
          findRecords: (type: string) => {
            const recs = [...((store[type] ?? []) as { id: string }[])];
            const origFilter = recs.filter.bind(recs);
            (
              recs as unknown as {
                filter: (f: unknown) => unknown;
              }
            ).filter = (f: unknown) => {
              if (typeof f === 'function')
                return origFilter(f as (r: { id: string }) => boolean);
              const spec = f as { relation: string; record: { id: string } };
              return origFilter(
                (r) => related(r, spec.relation) === spec.record.id
              );
            };
            return recs;
          },
          findRecord: (ident: { type: string; id: string }) => ident,
        };
        const spec = cb(q) as { type?: string; id?: string } | unknown[];
        if (Array.isArray(spec)) return spec;
        if (spec?.type && spec?.id)
          return ((store[spec.type] ?? []) as { id: string }[]).find(
            (r) => r.id === spec.id
          );
        return spec;
      },
    },
  } as unknown as Memory;
}

const idsIn = (files: Record<string, string>, filename: string) => {
  const json = files[filename];
  if (!json) return [] as string[];
  return (JSON.parse(json).data as { id: string }[]).map((r) => r.id);
};

describe('getProjectDataFiles project scoping', () => {
  const project = {
    type: 'project',
    id: 'proj-mine',
    keys: { remoteId: 'proj-mine' },
    attributes: {
      name: 'Mine',
      dateCreated: '2020-01-01T00:00:00.000Z',
      dateUpdated: '2020-01-01T00:00:00.000Z',
    },
    relationships: {
      organization: rel('organization', 'org-mine'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const offlineProject = {
    type: 'project',
    id: 'proj-local',
    attributes: {
      name: 'Local',
      dateCreated: '2020-01-01T00:00:00.000Z',
      dateUpdated: '2020-01-01T00:00:00.000Z',
    },
    relationships: {
      organization: rel('organization', 'org-local'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const store: Record<string, unknown[]> = {
    organization: [
      orgRec('org-mine', 'Mine Org'),
      orgRec('org-other', 'Other Org'),
      orgRec('org-local', 'Local Org', false),
    ],
    group: [
      {
        type: 'group',
        id: 'group-mine',
        keys: { remoteId: 'group-mine' },
        attributes: {
          name: 'G',
          dateCreated: '2020-01-01T00:00:00.000Z',
          dateUpdated: '2020-01-01T00:00:00.000Z',
        },
        relationships: {},
      },
    ],
    project: [project, offlineProject],
    groupmembership: [],
    user: [],
    intellectualproperty: [
      orgScoped('intellectualproperty', 'ip-mine', 'org-mine'),
      orgScoped('intellectualproperty', 'ip-mine-local', 'org-mine', false),
      orgScoped('intellectualproperty', 'ip-other', 'org-other'),
      orgScoped('intellectualproperty', 'ip-local', 'org-local', false),
    ],
    orgworkflowstep: [
      orgScoped('orgworkflowstep', 'ows-mine', 'org-mine'),
      orgScoped('orgworkflowstep', 'ows-other', 'org-other'),
      orgScoped('orgworkflowstep', 'ows-local', 'org-local', false),
    ],
    organizationbible: [
      orgScoped('organizationbible', 'ob-mine', 'org-mine'),
      orgScoped('organizationbible', 'ob-other', 'org-other'),
      orgScoped('organizationbible', 'ob-local', 'org-local', false),
    ],
    orgkeyterm: [
      orgScoped('orgkeyterm', 'okt-mine', 'org-mine'),
      orgScoped('orgkeyterm', 'okt-mine-local', 'org-mine', false),
      orgScoped('orgkeyterm', 'okt-other', 'org-other'),
      orgScoped('orgkeyterm', 'okt-local', 'org-local', false),
    ],
    artifactcategory: [
      {
        type: 'artifactcategory',
        id: 'cat-global',
        keys: { remoteId: 'cat-global' },
        attributes: {
          dateCreated: '2020-01-01T00:00:00.000Z',
          dateUpdated: '2020-01-01T00:00:00.000Z',
        },
        relationships: {},
      },
      {
        type: 'artifactcategory',
        id: 'cat-global-local',
        attributes: {
          dateCreated: '2020-01-01T00:00:00.000Z',
          dateUpdated: '2020-01-01T00:00:00.000Z',
        },
        relationships: { organization: { data: null } },
      },
    ],
  };

  it('omits other-org and unkeyed rows from an online project export', async () => {
    const memory = memoryStub(store);
    const files = await getProjectDataFiles(memory, project);

    expect(idsIn(files, 'data/B_organizations.json')).toEqual(['org-mine']);
    expect(idsIn(files, 'data/I_intellectualpropertys.json')).toEqual([
      'ip-mine',
    ]);
    expect(idsIn(files, 'data/C_orgworkflowsteps.json')).toEqual(['ows-mine']);
    expect(idsIn(files, 'data/I_organizationbibles.json')).toEqual(['ob-mine']);
    expect(idsIn(files, 'data/C_orgkeyterms.json')).toEqual(['okt-mine']);
    expect(idsIn(files, 'data/C_artifactcategorys.json')).toEqual([
      'cat-global',
    ]);
    expect(idsIn(files, 'data/D_projects.json')).toEqual(['proj-mine']);
  });

  it('keeps unkeyed org-scoped rows in an offline project export', async () => {
    const files = await getProjectDataFiles(memoryStub(store), offlineProject);

    expect(idsIn(files, 'data/B_organizations.json')).toEqual(['org-local']);
    expect(idsIn(files, 'data/I_intellectualpropertys.json')).toEqual([
      'ip-local',
    ]);
    expect(idsIn(files, 'data/C_orgworkflowsteps.json')).toEqual(['ows-local']);
    expect(idsIn(files, 'data/I_organizationbibles.json')).toEqual([
      'ob-local',
    ]);
    expect(idsIn(files, 'data/C_orgkeyterms.json')).toEqual(['okt-local']);
    expect(idsIn(files, 'data/C_artifactcategorys.json')).toEqual([
      'cat-global-local',
    ]);
    expect(idsIn(files, 'data/D_projects.json')).toEqual(['proj-local']);
  });

  it('unscoped getTableRecs follows the related-org remote cohort', () => {
    const memory = memoryStub(store);
    const online = createExportCollector(memory, true);
    expect(
      online
        .getTableRecs(
          { table: 'intellectualproperty', sort: 'I' },
          undefined,
          true
        )
        .map((r) => r.id)
        .sort()
    ).toEqual(['ip-mine', 'ip-mine-local', 'ip-other']);

    const offline = createExportCollector(memory, false);
    expect(
      offline
        .getTableRecs(
          { table: 'intellectualproperty', sort: 'I' },
          undefined,
          false
        )
        .map((r) => r.id)
    ).toEqual(['ip-local']);
  });
});

describe('supportingOrgs from supporting projects', () => {
  const dates = {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  };

  const project = {
    type: 'project',
    id: 'proj-mine',
    keys: { remoteId: 'proj-mine' },
    attributes: { name: 'Mine', ...dates },
    relationships: {
      organization: rel('organization', 'org-mine'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const projSrc = {
    type: 'project',
    id: 'proj-src',
    keys: { remoteId: 'proj-src' },
    attributes: { name: 'Source', ...dates },
    relationships: {
      organization: rel('organization', 'org-src'),
      group: rel('group', 'group-src'),
    },
  };

  const store: Record<string, unknown[]> = {
    organization: [
      orgRec('org-mine', 'Mine Org'),
      orgRec('org-src', 'Source Org'),
    ],
    group: [
      {
        type: 'group',
        id: 'group-mine',
        keys: { remoteId: 'group-mine' },
        attributes: { name: 'G', ...dates },
        relationships: {},
      },
    ],
    project: [project, projSrc],
    plan: [
      {
        type: 'plan',
        id: 'plan-mine',
        keys: { remoteId: 'plan-mine' },
        attributes: dates,
        relationships: { project: rel('project', 'proj-mine') },
      },
      {
        type: 'plan',
        id: 'plan-src',
        keys: { remoteId: 'plan-src' },
        attributes: dates,
        relationships: { project: rel('project', 'proj-src') },
      },
    ],
    section: [
      {
        type: 'section',
        id: 'sec-mine',
        keys: { remoteId: 'sec-mine' },
        attributes: dates,
        relationships: { plan: rel('plan', 'plan-mine') },
      },
      {
        type: 'section',
        id: 'sec-src',
        keys: { remoteId: 'sec-src' },
        attributes: dates,
        relationships: { plan: rel('plan', 'plan-src') },
      },
    ],
    passage: [
      {
        type: 'passage',
        id: 'pas-mine',
        keys: { remoteId: 'pas-mine' },
        attributes: dates,
        relationships: {
          section: rel('section', 'sec-mine'),
          sharedResource: rel('sharedresource', 'sr-1'),
        },
      },
      {
        type: 'passage',
        id: 'pas-src',
        keys: { remoteId: 'pas-src' },
        attributes: dates,
        relationships: { section: rel('section', 'sec-src') },
      },
    ],
    sharedresource: [
      {
        type: 'sharedresource',
        id: 'sr-1',
        keys: { remoteId: 'sr-1' },
        attributes: dates,
        relationships: { passage: rel('passage', 'pas-src') },
      },
    ],
    mediafile: [
      {
        type: 'mediafile',
        id: 'media-src',
        keys: { remoteId: 'media-src' },
        attributes: { ...dates, versionNumber: 1 },
        relationships: {
          plan: rel('plan', 'plan-src'),
          passage: rel('passage', 'pas-src'),
        },
      },
    ],
  };

  it('includes the supporting project org when the shared resource has no artifact category', async () => {
    const memory = memoryStub(store);
    const { supportingOrgs, supportingProjects } = createExportCollector(
      memory,
      true,
      { projRec: project, organizationId: 'org-mine' }
    );

    expect(supportingProjects(project).map((p) => p.id)).toEqual(['proj-src']);
    expect(supportingOrgs(project).map((o) => o.id)).toEqual(['org-src']);

    const files = await getProjectDataFiles(memory, project);
    expect(idsIn(files, 'data/Z_supportingorgs.json')).toEqual(['org-src']);
    expect(idsIn(files, 'data/Z_supportingprojects.json')).toEqual([
      'proj-src',
    ]);
    expect(idsIn(files, 'data/E_plans.json').sort()).toEqual([
      'plan-mine',
      'plan-src',
    ]);
    expect(idsIn(files, 'data/B_organizations.json')).toEqual(['org-mine']);
  });

  it('includes title media for a shared-note category owned by the supporting org', async () => {
    const withTitle = {
      ...store,
      artifactcategory: [
        {
          type: 'artifactcategory',
          id: 'cat-src',
          keys: { remoteId: 'cat-src' },
          attributes: dates,
          relationships: {
            organization: rel('organization', 'org-src'),
            titleMediafile: rel('mediafile', 'media-title'),
          },
        },
      ],
      sharedresource: [
        {
          type: 'sharedresource',
          id: 'sr-1',
          keys: { remoteId: 'sr-1' },
          attributes: dates,
          relationships: {
            passage: rel('passage', 'pas-src'),
            artifactCategory: rel('artifactcategory', 'cat-src'),
          },
        },
      ],
      mediafile: [
        {
          type: 'mediafile',
          id: 'media-title',
          keys: { remoteId: 'media-title' },
          attributes: { ...dates, audioUrl: 'title.mp3', versionNumber: 1 },
          relationships: {},
        },
      ],
    };
    const memory = memoryStub(withTitle);
    const { getTableRecs } = createExportCollector(memory, true, {
      projRec: project,
      organizationId: 'org-mine',
    });
    const media = getTableRecs(
      { table: 'mediafile', sort: 'H' },
      project,
      true
    );
    expect(media.map((m) => m.id)).toContain('media-title');

    const files = await getProjectDataFiles(memory, project);
    expect(idsIn(files, 'data/C_artifactcategorys.json')).toContain('cat-src');
    expect(idsIn(files, 'data/H_mediafiles.json')).toContain('media-title');
  });

  it('exports only the highest version of shared-note source media', () => {
    const withVersions = {
      ...store,
      mediafile: [
        {
          type: 'mediafile',
          id: 'media-v1',
          keys: { remoteId: 'media-v1' },
          attributes: { ...dates, versionNumber: 1 },
          relationships: { passage: rel('passage', 'pas-src') },
        },
        {
          type: 'mediafile',
          id: 'media-v3',
          keys: { remoteId: 'media-v3' },
          attributes: { ...dates, versionNumber: 3 },
          relationships: { passage: rel('passage', 'pas-src') },
        },
        {
          type: 'mediafile',
          id: 'media-v2',
          keys: { remoteId: 'media-v2' },
          attributes: { ...dates, versionNumber: 2 },
          relationships: { passage: rel('passage', 'pas-src') },
        },
      ],
    };
    const { getTableRecs } = createExportCollector(
      memoryStub(withVersions),
      true,
      { projRec: project, organizationId: 'org-mine' }
    );
    const media = getTableRecs(
      { table: 'mediafile', sort: 'H' },
      project,
      true
    );
    expect(media.map((m) => m.id)).toEqual(['media-v3']);
  });

  it('includes a project whose plan owns exported media without a shared note', async () => {
    const projIp = {
      type: 'project',
      id: 'proj-ip',
      keys: { remoteId: 'proj-ip' },
      attributes: { name: 'IP Source', ...dates },
      relationships: { organization: rel('organization', 'org-ip') },
    };
    const withIp = {
      ...store,
      organization: [
        orgRec('org-mine', 'Mine Org'),
        orgRec('org-ip', 'IP Org'),
      ],
      project: [project, projIp],
      plan: [
        ...(store.plan ?? []),
        {
          type: 'plan',
          id: 'plan-ip',
          keys: { remoteId: 'plan-ip' },
          attributes: dates,
          relationships: { project: rel('project', 'proj-ip') },
        },
      ],
      intellectualproperty: [
        {
          type: 'intellectualproperty',
          id: 'ip-1',
          keys: { remoteId: 'ip-1' },
          attributes: dates,
          relationships: {
            organization: rel('organization', 'org-mine'),
            releaseMediafile: rel('mediafile', 'media-ip'),
          },
        },
      ],
      mediafile: [
        {
          type: 'mediafile',
          id: 'media-ip',
          keys: { remoteId: 'media-ip' },
          attributes: { ...dates, versionNumber: 1 },
          relationships: { plan: rel('plan', 'plan-ip') },
        },
      ],
    };
    const memory = memoryStub(withIp);
    const { getTableRecs, supportingProjects, supportingOrgs } =
      createExportCollector(memory, true, {
        projRec: project,
        organizationId: 'org-mine',
      });
    expect(supportingProjects(project).map((p) => p.id)).toEqual(['proj-ip']);
    expect(supportingOrgs(project).map((o) => o.id)).toEqual(['org-ip']);
    expect(
      getTableRecs({ table: 'plan', sort: 'E' }, project, true)
        .map((p) => p.id)
        .sort()
    ).toEqual(['plan-ip', 'plan-mine']);

    const files = await getProjectDataFiles(memory, project);
    expect(idsIn(files, 'data/Z_supportingprojects.json')).toEqual(['proj-ip']);
    expect(idsIn(files, 'data/E_plans.json').sort()).toEqual([
      'plan-ip',
      'plan-mine',
    ]);
  });
});

describe('fromIds remote identity cohort', () => {
  const dates = {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  };

  const onlineProject = {
    type: 'project',
    id: 'proj-mine',
    keys: { remoteId: 'proj-mine' },
    attributes: { name: 'Mine', ...dates },
    relationships: {
      organization: rel('organization', 'org-mine'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const offlineProject = {
    ...onlineProject,
    keys: undefined,
  } as unknown as ProjectD;

  const store: Record<string, unknown[]> = {
    organization: [orgRec('org-mine', 'Mine Org')],
    group: [
      {
        type: 'group',
        id: 'group-mine',
        keys: { remoteId: 'group-mine' },
        attributes: { name: 'G', ...dates },
        relationships: {},
      },
    ],
    project: [onlineProject],
    plan: [
      {
        type: 'plan',
        id: 'plan-mine',
        keys: { remoteId: 'plan-mine' },
        attributes: dates,
        relationships: { project: rel('project', 'proj-mine') },
      },
    ],
    section: [
      {
        type: 'section',
        id: 'sec-mine',
        keys: { remoteId: 'sec-mine' },
        attributes: dates,
        relationships: { plan: rel('plan', 'plan-mine') },
      },
    ],
    passage: [
      {
        type: 'passage',
        id: 'pas-mine',
        keys: { remoteId: 'pas-mine' },
        attributes: dates,
        relationships: { section: rel('section', 'sec-mine') },
      },
    ],
    sectionresource: [
      {
        type: 'sectionresource',
        id: 'sr-remote',
        keys: { remoteId: 'sr-remote' },
        attributes: dates,
        relationships: { section: rel('section', 'sec-mine') },
      },
      {
        type: 'sectionresource',
        id: 'sr-local',
        attributes: dates,
        relationships: { section: rel('section', 'sec-mine') },
      },
    ],
    sharedresource: [
      {
        type: 'sharedresource',
        id: 'shr-remote',
        keys: { remoteId: 'shr-remote' },
        attributes: dates,
        relationships: { passage: rel('passage', 'pas-mine') },
      },
      {
        type: 'sharedresource',
        id: 'shr-local',
        attributes: dates,
        relationships: { passage: rel('passage', 'pas-mine') },
      },
    ],
  };

  it('omits local-only static rows from an online project export', async () => {
    const files = await getProjectDataFiles(memoryStub(store), onlineProject);
    expect(idsIn(files, 'data/I_sectionresources.json')).toEqual(['sr-remote']);
    expect(idsIn(files, 'data/I_sharedresources.json')).toEqual(['shr-remote']);
  });

  it('keeps local-only static rows in an offline project export', async () => {
    const files = await getProjectDataFiles(
      memoryStub({ ...store, project: [offlineProject] }),
      offlineProject
    );
    expect(idsIn(files, 'data/I_sectionresources.json')).toEqual(['sr-local']);
    expect(idsIn(files, 'data/I_sharedresources.json')).toEqual(['shr-local']);
  });
});

describe('org groups, memberships, and users', () => {
  const dates = {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  };

  const project = {
    type: 'project',
    id: 'proj-mine',
    keys: { remoteId: 'proj-mine' },
    attributes: { name: 'Mine', ...dates },
    relationships: {
      organization: rel('organization', 'org-mine'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const groupRec = (id: string, orgId: string, keyed = true) => ({
    type: 'group',
    id,
    ...(keyed ? { keys: { remoteId: id } } : {}),
    attributes: { name: id, ...dates },
    relationships: { owner: rel('organization', orgId) },
  });

  const gmRec = (id: string, groupId: string, userId: string) => ({
    type: 'groupmembership',
    id,
    keys: { remoteId: id },
    attributes: dates,
    relationships: {
      group: rel('group', groupId),
      user: rel('user', userId),
    },
  });

  const userRec = (id: string) => ({
    type: 'user',
    id,
    keys: { remoteId: id },
    attributes: { name: id, ...dates },
    relationships: {},
  });

  const store: Record<string, unknown[]> = {
    organization: [
      orgRec('org-mine', 'Mine Org'),
      orgRec('org-other', 'Other Org'),
    ],
    group: [
      groupRec('group-mine', 'org-mine'),
      groupRec('group-extra', 'org-mine'),
      groupRec('group-foreign', 'org-other'),
      groupRec('group-local', 'org-mine', false),
    ],
    groupmembership: [
      gmRec('gm-mine', 'group-mine', 'user-mine'),
      gmRec('gm-extra', 'group-extra', 'user-extra'),
      gmRec('gm-foreign', 'group-foreign', 'user-foreign'),
      gmRec('gm-local', 'group-local', 'user-local'),
    ],
    user: [
      userRec('user-mine'),
      userRec('user-extra'),
      userRec('user-foreign'),
      userRec('user-local'),
    ],
    project: [project],
  };

  it('exports all org-owned groups, their memberships, and those users', async () => {
    const files = await getProjectDataFiles(memoryStub(store), project);
    expect(idsIn(files, 'data/C_groups.json').sort()).toEqual([
      'group-extra',
      'group-mine',
    ]);
    expect(idsIn(files, 'data/D_groupmemberships.json').sort()).toEqual([
      'gm-extra',
      'gm-mine',
    ]);
    expect(idsIn(files, 'data/A_users.json').sort()).toEqual([
      'user-extra',
      'user-mine',
    ]);
  });
});

describe('bible media in export', () => {
  const dates = {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  };

  const project = {
    type: 'project',
    id: 'proj-mine',
    keys: { remoteId: 'proj-mine' },
    attributes: { name: 'Mine', ...dates },
    relationships: {
      organization: rel('organization', 'org-mine'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const mediaRec = (id: string) => ({
    type: 'mediafile',
    id,
    keys: { remoteId: id },
    attributes: { ...dates, audioUrl: `${id}.mp3`, versionNumber: 1 },
    relationships: {},
  });

  const store: Record<string, unknown[]> = {
    organization: [
      orgRec('org-mine', 'Mine Org'),
      orgRec('org-other', 'Other Org'),
    ],
    group: [
      {
        type: 'group',
        id: 'group-mine',
        keys: { remoteId: 'group-mine' },
        attributes: { name: 'G', ...dates },
        relationships: { owner: rel('organization', 'org-mine') },
      },
    ],
    project: [project],
    organizationbible: [
      {
        ...orgScoped('organizationbible', 'ob-mine', 'org-mine'),
        relationships: {
          organization: rel('organization', 'org-mine'),
          bible: rel('bible', 'bible-mine'),
        },
      },
      {
        ...orgScoped('organizationbible', 'ob-other', 'org-other'),
        relationships: {
          organization: rel('organization', 'org-other'),
          bible: rel('bible', 'bible-other'),
        },
      },
    ],
    bible: [
      {
        type: 'bible',
        id: 'bible-mine',
        keys: { remoteId: 'bible-mine' },
        attributes: dates,
        relationships: {
          bibleMediafile: rel('mediafile', 'media-bible'),
          isoMediafile: rel('mediafile', 'media-iso'),
        },
      },
      {
        type: 'bible',
        id: 'bible-other',
        keys: { remoteId: 'bible-other' },
        attributes: dates,
        relationships: {
          bibleMediafile: rel('mediafile', 'media-other'),
        },
      },
    ],
    mediafile: [
      mediaRec('media-bible'),
      mediaRec('media-iso'),
      mediaRec('media-other'),
    ],
  };

  it('includes bibleMediafile and isoMediafile for the org bible', async () => {
    const files = await getProjectDataFiles(memoryStub(store), project);
    expect(idsIn(files, 'data/I_bibles.json')).toEqual(['bible-mine']);
    expect(idsIn(files, 'data/H_mediafiles.json').sort()).toEqual([
      'media-bible',
      'media-iso',
    ]);
  });
});

describe('discussions from plan media', () => {
  const dates = {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  };

  const project = {
    type: 'project',
    id: 'proj-mine',
    keys: { remoteId: 'proj-mine' },
    attributes: { name: 'Mine', ...dates },
    relationships: {
      organization: rel('organization', 'org-mine'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const disc = (id: string, mediaId: string) => ({
    type: 'discussion',
    id,
    keys: { remoteId: id },
    attributes: dates,
    relationships: { mediafile: rel('mediafile', mediaId) },
  });

  const store: Record<string, unknown[]> = {
    organization: [orgRec('org-mine', 'Mine Org')],
    group: [
      {
        type: 'group',
        id: 'group-mine',
        keys: { remoteId: 'group-mine' },
        attributes: { name: 'G', ...dates },
        relationships: { owner: rel('organization', 'org-mine') },
      },
    ],
    project: [project],
    plan: [
      {
        type: 'plan',
        id: 'plan-mine',
        keys: { remoteId: 'plan-mine' },
        attributes: dates,
        relationships: { project: rel('project', 'proj-mine') },
      },
      {
        type: 'plan',
        id: 'plan-other',
        keys: { remoteId: 'plan-other' },
        attributes: dates,
        relationships: { project: rel('project', 'proj-other') },
      },
    ],
    mediafile: [
      {
        type: 'mediafile',
        id: 'media-passage',
        keys: { remoteId: 'media-passage' },
        attributes: { ...dates, versionNumber: 1 },
        relationships: {
          plan: rel('plan', 'plan-mine'),
          passage: rel('passage', 'pas-mine'),
        },
      },
      {
        type: 'mediafile',
        id: 'media-no-passage',
        keys: { remoteId: 'media-no-passage' },
        attributes: { ...dates, versionNumber: 1 },
        relationships: { plan: rel('plan', 'plan-mine') },
      },
      {
        type: 'mediafile',
        id: 'media-other-plan',
        keys: { remoteId: 'media-other-plan' },
        attributes: { ...dates, versionNumber: 1 },
        relationships: { plan: rel('plan', 'plan-other') },
      },
    ],
    discussion: [
      disc('disc-passage', 'media-passage'),
      disc('disc-no-passage', 'media-no-passage'),
      disc('disc-other', 'media-other-plan'),
    ],
  };

  it('includes discussions on plan media with or without a passage', async () => {
    const files = await getProjectDataFiles(memoryStub(store), project);
    expect(idsIn(files, 'data/I_discussions.json').sort()).toEqual([
      'disc-no-passage',
      'disc-passage',
    ]);
  });
});

describe('orgkeytermreference org scope', () => {
  const dates = {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  };

  const project = {
    type: 'project',
    id: 'proj-mine',
    keys: { remoteId: 'proj-mine' },
    attributes: { name: 'Mine', ...dates },
    relationships: {
      organization: rel('organization', 'org-mine'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const refRec = (id: string, termId: string, projectId: string) => ({
    type: 'orgkeytermreference',
    id,
    keys: { remoteId: id },
    attributes: dates,
    relationships: {
      orgkeyterm: rel('orgkeyterm', termId),
      project: rel('project', projectId),
    },
  });

  const store: Record<string, unknown[]> = {
    organization: [
      orgRec('org-mine', 'Mine Org'),
      orgRec('org-other', 'Other Org'),
    ],
    group: [
      {
        type: 'group',
        id: 'group-mine',
        keys: { remoteId: 'group-mine' },
        attributes: { name: 'G', ...dates },
        relationships: { owner: rel('organization', 'org-mine') },
      },
    ],
    project: [project],
    orgkeyterm: [
      orgScoped('orgkeyterm', 'okt-mine', 'org-mine'),
      orgScoped('orgkeyterm', 'okt-other', 'org-other'),
    ],
    orgkeytermreference: [
      refRec('ref-mine', 'okt-mine', 'proj-mine'),
      refRec('ref-sibling', 'okt-mine', 'proj-sibling'),
      refRec('ref-other', 'okt-other', 'proj-other'),
    ],
  };

  it('includes references for every project on the org key terms', async () => {
    const files = await getProjectDataFiles(memoryStub(store), project);
    expect(idsIn(files, 'data/C_orgkeyterms.json')).toEqual(['okt-mine']);
    expect(idsIn(files, 'data/H_orgkeytermreferences.json').sort()).toEqual([
      'ref-mine',
      'ref-sibling',
    ]);
  });
});

describe('shared internalization source media (Plan B → A1)', () => {
  const dates = {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  };

  const projectB = {
    type: 'project',
    id: 'proj-b',
    keys: { remoteId: 'proj-b' },
    attributes: { name: 'Plan B', ...dates },
    relationships: {
      organization: rel('organization', 'org-b'),
      group: rel('group', 'group-b'),
    },
  } as unknown as ProjectD;

  const mediaRec = (
    id: string,
    attrs: Record<string, unknown>,
    relationships: Record<string, unknown>
  ) => ({
    type: 'mediafile',
    id,
    keys: { remoteId: id },
    attributes: { ...dates, versionNumber: 1, ...attrs },
    relationships,
  });

  const baseStore = (bm1: Record<string, unknown>) => ({
    organization: [orgRec('org-b', 'Org B'), orgRec('org-a', 'Org A')],
    group: [
      {
        type: 'group',
        id: 'group-b',
        keys: { remoteId: 'group-b' },
        attributes: { name: 'G', ...dates },
        relationships: { owner: rel('organization', 'org-b') },
      },
    ],
    project: [
      projectB,
      {
        type: 'project',
        id: 'proj-a',
        keys: { remoteId: 'proj-a' },
        attributes: { name: 'Plan A', ...dates },
        relationships: { organization: rel('organization', 'org-a') },
      },
    ],
    plan: [
      {
        type: 'plan',
        id: 'plan-b',
        keys: { remoteId: 'plan-b' },
        attributes: dates,
        relationships: { project: rel('project', 'proj-b') },
      },
      {
        type: 'plan',
        id: 'plan-a',
        keys: { remoteId: 'plan-a' },
        attributes: dates,
        relationships: { project: rel('project', 'proj-a') },
      },
    ],
    section: [
      {
        type: 'section',
        id: 'sec-b',
        keys: { remoteId: 'sec-b' },
        attributes: dates,
        relationships: { plan: rel('plan', 'plan-b') },
      },
      {
        type: 'section',
        id: 'sec-a',
        keys: { remoteId: 'sec-a' },
        attributes: dates,
        relationships: { plan: rel('plan', 'plan-a') },
      },
    ],
    passage: [
      {
        type: 'passage',
        id: 'pas-b-internalize',
        keys: { remoteId: 'pas-b-internalize' },
        attributes: dates,
        relationships: { section: rel('section', 'sec-b') },
      },
      {
        type: 'passage',
        id: 'pas-a1',
        keys: { remoteId: '42' },
        attributes: dates,
        relationships: { section: rel('section', 'sec-a') },
      },
    ],
    sharedresource: [
      {
        type: 'sharedresource',
        id: 'sr-1',
        keys: { remoteId: 'sr-1' },
        attributes: dates,
        relationships: { passage: rel('passage', 'pas-a1') },
      },
    ],
    sectionresource: [
      {
        type: 'sectionresource',
        id: 'secres-b',
        keys: { remoteId: 'secres-b' },
        attributes: dates,
        relationships: {
          section: rel('section', 'sec-b'),
          mediafile: rel('mediafile', 'bm1'),
          passage: rel('passage', 'pas-b-internalize'),
        },
      },
    ],
    mediafile: [
      mediaRec(
        'asm1',
        { readyToShare: true, originalFile: 'a1.mp3', audioUrl: 'a1.mp3' },
        {
          plan: rel('plan', 'plan-a'),
          passage: rel('passage', 'pas-a1'),
        }
      ),
      bm1,
    ],
  });

  const exportedMedia = (bm1: Record<string, unknown>) => {
    const { getTableRecs } = createExportCollector(
      memoryStub(baseStore(bm1)),
      true,
      { projRec: projectB, organizationId: 'org-b' }
    );
    return getTableRecs({ table: 'mediafile', sort: 'H' }, projectB, true).map(
      (m) => m.id
    );
  };

  it('includes A1 source media when BM1 has resourcePassageId (how shared resources are created)', () => {
    expect(
      exportedMedia(
        mediaRec(
          'bm1',
          { resourcePassageId: 42, originalFile: 'a1.mp3' },
          {
            plan: rel('plan', 'plan-b'),
            passage: rel('passage', 'pas-b-internalize'),
          }
        )
      ).sort()
    ).toEqual(['asm1', 'bm1']);
  });

  it('includes A1 source media when BM1 has the resourcePassage relationship', () => {
    expect(
      exportedMedia(
        mediaRec(
          'bm1',
          { readyToShare: false, originalFile: 'a1.mp3' },
          {
            plan: rel('plan', 'plan-b'),
            passage: rel('passage', 'pas-b-internalize'),
            resourcePassage: rel('passage', 'pas-a1'),
          }
        )
      ).sort()
    ).toEqual(['asm1', 'bm1']);
  });

  it('does not pull A1 media from a section resource that does not point at A1', () => {
    expect(
      exportedMedia(
        mediaRec(
          'bm1',
          { resourcePassageId: -1, originalFile: 'other.mp3' },
          { plan: rel('plan', 'plan-b') }
        )
      )
    ).toEqual(['bm1']);
  });

  it('omits A1 source media that is not readyToShare', () => {
    const bm1 = mediaRec(
      'bm1',
      { resourcePassageId: 42, originalFile: 'a1.mp3' },
      {
        plan: rel('plan', 'plan-b'),
        passage: rel('passage', 'pas-b-internalize'),
      }
    );
    const store = baseStore(bm1);
    const asm1 = store.mediafile[0] as {
      attributes: { readyToShare: boolean };
    };
    asm1.attributes.readyToShare = false;
    const { getTableRecs } = createExportCollector(memoryStub(store), true, {
      projRec: projectB,
      organizationId: 'org-b',
    });
    expect(
      getTableRecs({ table: 'mediafile', sort: 'H' }, projectB, true).map(
        (m) => m.id
      )
    ).toEqual(['bm1']);
  });
});

describe('graphic media omitted from PTF', () => {
  const dates = {
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  };

  const project = {
    type: 'project',
    id: 'proj-mine',
    keys: { remoteId: 'proj-mine' },
    attributes: { name: 'Mine', ...dates },
    relationships: {
      organization: rel('organization', 'org-mine'),
      group: rel('group', 'group-mine'),
    },
  } as unknown as ProjectD;

  const store: Record<string, unknown[]> = {
    organization: [orgRec('org-mine', 'Mine Org')],
    group: [
      {
        type: 'group',
        id: 'group-mine',
        keys: { remoteId: 'group-mine' },
        attributes: { name: 'G', ...dates },
        relationships: {},
      },
    ],
    project: [project],
    plan: [
      {
        type: 'plan',
        id: 'plan-mine',
        keys: { remoteId: 'plan-mine' },
        attributes: dates,
        relationships: { project: rel('project', 'proj-mine') },
      },
    ],
    section: [
      {
        type: 'section',
        id: 'sec-mine',
        keys: { remoteId: 'sec-mine' },
        attributes: dates,
        relationships: { plan: rel('plan', 'plan-mine') },
      },
    ],
    passage: [
      {
        type: 'passage',
        id: 'pas-mine',
        keys: { remoteId: '42' },
        attributes: dates,
        relationships: { section: rel('section', 'sec-mine') },
      },
    ],
    graphic: [
      {
        type: 'graphic',
        id: 'gr-1',
        keys: { remoteId: 'gr-1' },
        attributes: {
          ...dates,
          resourceType: 'passage',
          resourceId: 42,
          info: '{}',
        },
        relationships: {
          organization: rel('organization', 'org-mine'),
          mediafile: rel('mediafile', 'media-graphic'),
        },
      },
    ],
    mediafile: [
      {
        type: 'mediafile',
        id: 'media-vern',
        keys: { remoteId: 'media-vern' },
        attributes: { ...dates, versionNumber: 1, audioUrl: 'vern.mp3' },
        relationships: {
          plan: rel('plan', 'plan-mine'),
          passage: rel('passage', 'pas-mine'),
        },
      },
      {
        type: 'mediafile',
        id: 'media-graphic',
        keys: { remoteId: 'media-graphic' },
        attributes: { ...dates, versionNumber: 1, audioUrl: 'graphic.png' },
        relationships: {
          plan: rel('plan', 'plan-mine'),
          passage: rel('passage', 'pas-mine'),
        },
      },
    ],
  };

  it('keeps graphic rows but omits the shared graphic mediafile', async () => {
    const files = await getProjectDataFiles(memoryStub(store), project);
    expect(idsIn(files, 'data/I_graphics.json')).toEqual(['gr-1']);
    expect(idsIn(files, 'data/H_mediafiles.json')).toEqual(['media-vern']);
  });
});
