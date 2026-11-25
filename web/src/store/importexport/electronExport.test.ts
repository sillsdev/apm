/**
 * TT-7911: reconnect sync runs electronExport repeatedly in one desktop
 * session. Every zipOpen handle lives in a main-process map until zipClose,
 * so each one the export opens must be closed — on success and on failure.
 */
import type Memory from '@orbit/memory';
import type { InitializedRecord } from '@orbit/records';

let mockTableRecs: (table: string) => InitializedRecord[] = () => [];
jest.mock('./exportTableRecs', () => ({
  createExportCollector: () => ({
    getTableRecs: (info: { table: string }) => mockTableRecs(info.table),
    supportingProjects: () => [],
    supportingOrgs: () => [],
  }),
}));

let mockStore: Record<string, InitializedRecord[]> = {};
jest.mock('../../crud/tryFindRecord', () => ({
  findRecords: (_m: unknown, type: string) => mockStore[type] ?? [],
}));
jest.mock('../../crud/syncToMemory', () => ({
  backupToMemory: jest.fn(),
}));
jest.mock('../../crud', () => ({
  related: jest.requireActual('../../crud/related').related,
  remoteId: (_k: string, id: string) => 'r' + id,
  remoteIdGuid: () => undefined,
  findRecord: (_m: unknown, type: string, id: string) =>
    (mockStore[type] ?? []).find((r) => r.id === id),
  updateableFiles: jest.requireActual('../../crud/fileOrder').updateableFiles,
  staticFiles: jest.requireActual('../../crud/fileOrder').staticFiles,
  nameFromTemplate: jest.fn(),
  getMediaEaf: jest.fn(),
  VernacularTag: null,
}));
jest.mock('../../serializers/getSerializer', () => ({
  getSerializer: () => ({
    serialize: (r: InitializedRecord) => ({ type: r.type, id: r.id }),
  }),
}));
jest.mock('../../utils', () => ({
  dataPath: async (p: string) => 'C:/data/' + p,
  cleanExportFileName: (s: string) => s,
  currentDateTime: () => '2026-11-25T00:00:00.000Z',
  PathType: {
    AVATARS: 'avatars',
    LOGOS: 'logos',
    MEDIA: 'media',
    FONTS: 'fonts',
  },
  createFolder: jest.fn(),
  createPathFolder: jest.fn(),
}));

const open = new Set<string>();
let opened = 0;
const api = {
  zipOpen: jest.fn(async () => {
    const h = 'z' + ++opened;
    open.add(h);
    return h;
  }),
  zipClose: jest.fn(async (h: string) => {
    open.delete(h);
  }),
  zipAddFile: jest.fn(),
  zipAddJson: jest.fn(),
  zipAddZip: jest.fn(),
  zipAddLocal: jest.fn(),
  zipWrite: jest.fn(),
  zipToBuffer: jest.fn(async () => Buffer.from('itf')),
  exists: jest.fn(async () => false),
  readDir: jest.fn(async () => []),
};
(window as unknown as { api?: unknown }).api = api;

// Imported after window.api is set: the module captures it at load.
import { electronExport } from './electronExport';
import { ExportType } from './types';

const project = (id: string) =>
  ({
    type: 'project',
    id,
    keys: { remoteId: 'r' + id },
    attributes: { name: 'Proj ' + id },
    relationships: {
      organization: { data: { type: 'organization', id: 'o1' } },
    },
  }) as unknown as InitializedRecord;

const offline = (projectId: string) =>
  ({
    type: 'offlineproject',
    id: 'op' + projectId,
    attributes: {
      offlineAvailable: true,
      snapshotDate: '2020-01-01T00:00:00.000Z',
    },
    relationships: { project: { data: { type: 'project', id: projectId } } },
  }) as unknown as InitializedRecord;

const passage = (id: string, keyed = true) =>
  ({
    type: 'passage',
    id,
    ...(keyed ? { keys: { remoteId: 'r' + id } } : {}),
    attributes: {
      dateCreated: '2026-01-01T00:00:00.000Z',
      dateUpdated: '2026-01-01T00:00:00.000Z',
    },
  }) as unknown as InitializedRecord;

const run = (exportType: ExportType, projectid: string = 'p1') =>
  electronExport(
    exportType,
    undefined,
    { keyMap: {} } as unknown as Memory,
    undefined,
    projectid,
    'u1',
    'no data',
    'artifact',
    () => offline(projectid) as never
  );

describe('electronExport releases every zip handle (TT-7911)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    open.clear();
    opened = 0;
    mockStore = {
      project: [project('p1'), project('p2')],
      offlineproject: [offline('p1'), offline('p2')],
    };
    mockTableRecs = (table) => (table === 'passage' ? [passage('s1')] : []);
  });

  it('closes the per-project archives and the outer archive on an ITFSYNC', async () => {
    const result = await run(ExportType.ITFSYNC);
    expect(result?.changes).toBeGreaterThan(0);
    expect(api.zipAddZip).toHaveBeenCalledTimes(2);
    expect(opened).toBe(3);
    expect(open.size).toBe(0);
  });

  it('closes the fallback ITF archive on a full backup with filtered records', async () => {
    mockStore.project = [project('p1')];
    mockStore.offlineproject = [offline('p1')];
    mockTableRecs = (table) =>
      table === 'passage' ? [passage('s1'), passage('s2', false)] : [];
    await run(ExportType.FULLBACKUP);
    expect(api.zipAddZip).toHaveBeenCalledTimes(2);
    expect(opened).toBe(3);
    expect(open.size).toBe(0);
  });

  it('closes the project archive when a single-project export has no data', async () => {
    mockTableRecs = () => [];
    await expect(run(ExportType.ITF)).rejects.toThrow('no data');
    expect(opened).toBe(1);
    expect(open.size).toBe(0);
  });

  it('closes the project archive after writing a single-project export', async () => {
    await run(ExportType.ITF);
    expect(api.zipWrite).toHaveBeenCalledTimes(1);
    expect(opened).toBe(1);
    expect(open.size).toBe(0);
  });

  it('closes every archive when adding a project archive fails', async () => {
    api.zipAddZip.mockRejectedValueOnce(new Error('zip failed'));
    await expect(run(ExportType.ITFSYNC)).rejects.toThrow('zip failed');
    expect(opened).toBe(2);
    expect(open.size).toBe(0);
  });
});
