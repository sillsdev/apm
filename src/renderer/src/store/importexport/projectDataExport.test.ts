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
    expect(idsIn(files, 'data/J_organizationbibles.json')).toEqual(['ob-mine']);
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
    expect(idsIn(files, 'data/J_organizationbibles.json')).toEqual([
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
