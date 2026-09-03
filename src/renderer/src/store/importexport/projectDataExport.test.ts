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

const orgRec = (id: string, name: string) => ({
  type: 'organization',
  id,
  keys: { remoteId: id },
  attributes: {
    name,
    dateCreated: '2020-01-01T00:00:00.000Z',
    dateUpdated: '2020-01-01T00:00:00.000Z',
  },
  relationships: {},
});

const orgScoped = (type: string, id: string, orgId: string) => ({
  type,
  id,
  keys: { remoteId: id },
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
      idToKey: (_table: string, _key: string, localId: string) =>
        localId ? `rid-${localId}` : undefined,
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
        attributes: {
          name: 'G',
          dateCreated: '2020-01-01T00:00:00.000Z',
          dateUpdated: '2020-01-01T00:00:00.000Z',
        },
        relationships: {},
      },
    ],
    project: [project],
    groupmembership: [],
    user: [],
    intellectualproperty: [
      orgScoped('intellectualproperty', 'ip-mine', 'org-mine'),
      orgScoped('intellectualproperty', 'ip-other', 'org-other'),
    ],
    orgworkflowstep: [
      orgScoped('orgworkflowstep', 'ows-mine', 'org-mine'),
      orgScoped('orgworkflowstep', 'ows-other', 'org-other'),
    ],
    organizationbible: [
      orgScoped('organizationbible', 'ob-mine', 'org-mine'),
      orgScoped('organizationbible', 'ob-other', 'org-other'),
    ],
    orgkeyterm: [
      orgScoped('orgkeyterm', 'okt-mine', 'org-mine'),
      orgScoped('orgkeyterm', 'okt-other', 'org-other'),
    ],
  };

  it('omits other-org records when memory has only the selected project', async () => {
    const memory = memoryStub(store);
    const files = await getProjectDataFiles(memory, project);

    expect(idsIn(files, 'data/B_organizations.json')).toEqual(['org-mine']);
    expect(idsIn(files, 'data/I_intellectualpropertys.json')).toEqual([
      'ip-mine',
    ]);
    expect(idsIn(files, 'data/C_orgworkflowsteps.json')).toEqual(['ows-mine']);
    expect(idsIn(files, 'data/J_organizationbibles.json')).toEqual(['ob-mine']);
    expect(idsIn(files, 'data/C_orgkeyterms.json')).toEqual(['okt-mine']);
    expect(idsIn(files, 'data/D_projects.json')).toEqual(['proj-mine']);
  });

  it('still returns all org-scoped rows when getTableRecs is unscoped', () => {
    const memory = memoryStub(store);
    const { getTableRecs } = createExportCollector(memory, true);
    const ips = getTableRecs(
      { table: 'intellectualproperty', sort: 'I' },
      undefined,
      true
    );
    expect(ips.map((r) => r.id).sort()).toEqual(['ip-mine', 'ip-other']);
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
});
