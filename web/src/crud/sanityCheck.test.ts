import type Memory from '@orbit/memory';
import { DateTime } from 'luxon';
import type { PlanD } from '../model/plan';
import type { ProjectD } from '../model/project';
import type { BaseModel } from '../model/baseModel';
import {
  CHECKSUM_MODULUS,
  checksumOf,
  dedupedChecksumRows,
  isoToMillis,
  maxUpdatedMillis,
  rowsForSanityTable,
} from './sanityCheck';

const rec = (
  type: string,
  id: string,
  rels?: Record<string, { data: { type: string; id: string } | null }> | null,
  extra?: { remoteId?: string; dateUpdated?: string }
) => {
  const row: {
    id: string;
    type: string;
    attributes: {
      dateCreated: string;
      dateUpdated: string;
      lastModifiedBy: number;
    };
    keys?: { remoteId: string };
    relationships?: Record<
      string,
      { data: { type: string; id: string } | null }
    >;
  } = {
    id,
    type,
    attributes: {
      dateCreated: '',
      dateUpdated: extra?.dateUpdated ?? '',
      lastModifiedBy: 0,
    },
  };
  if (extra?.remoteId) row.keys = { remoteId: extra.remoteId };
  if (rels !== null) row.relationships = rels ?? {};
  return row;
};

const link = (type: string, id: string) => ({ data: { type, id } });

const memoryWith = (byType: Record<string, ReturnType<typeof rec>[]>) => {
  const memory = {
    cache: {
      query: (cb: (q: unknown) => unknown) => {
        const expr = cb({
          findRecords: (type: string) => ({
            kind: 'records' as const,
            type,
            spec: undefined as
              { relation: string; record: { id: string } } | undefined,
            filter(spec: { relation: string; record: { id: string } }) {
              return { kind: 'records' as const, type, spec };
            },
          }),
          findRecord: (identity: { type: string; id: string }) => ({
            kind: 'record' as const,
            ...identity,
          }),
        }) as {
          kind: 'records' | 'record';
          type: string;
          id?: string;
          spec?: { relation: string; record: { id: string } };
        };
        const rows = byType[expr.type] ?? [];
        if (expr.kind === 'record')
          return rows.find((row) => row.id === expr.id);
        const spec = expr.spec;
        if (!spec) return rows;
        // Mock rows are untyped fixtures; read the to-one id the same way related does.
        return rows.filter((row) => {
          const data = (
            row as {
              relationships?: Record<string, { data?: { id?: string } }>;
            }
          ).relationships?.[spec.relation]?.data;
          return data?.id === spec.record.id;
        });
      },
    },
  } as unknown as Memory;
  return memory;
};

const project = rec('project', 'proj', {
  organization: link('organization', 'org-1'),
}) as unknown as ProjectD;

const plan = rec('plan', 'plan-1') as unknown as PlanD;

describe('isoToMillis', () => {
  it('returns 0 for an empty timestamp', () => {
    expect(isoToMillis('')).toBe(0);
  });

  it('treats a missing Z as UTC', () => {
    const stamped = '2020-01-02T03:04:05';
    expect(isoToMillis(stamped)).toBe(isoToMillis(`${stamped}Z`));
    expect(isoToMillis(`${stamped}Z`)).toBe(
      DateTime.fromISO(`${stamped}Z`).toMillis()
    );
  });

  it('returns 0 when the timestamp cannot be parsed', () => {
    expect(isoToMillis('not-a-date')).toBe(0);
  });
});

describe('checksumOf', () => {
  it('is 0 for no rows', () => {
    expect(checksumOf([])).toBe(0);
  });

  it('sums each timestamp modulo the checksum range', () => {
    expect(
      checksumOf([
        { id: 'a', num: CHECKSUM_MODULUS },
        { id: 'b', num: CHECKSUM_MODULUS + 1 },
      ])
    ).toBe(1);
  });
});

describe('dedupedChecksumRows', () => {
  it('keeps the first remote id and drops rows without relationships', () => {
    const rows = [
      rec(
        'mediafile',
        'a',
        {},
        { remoteId: '9', dateUpdated: '2020-01-01T00:00:00Z' }
      ),
      rec(
        'mediafile',
        'b',
        {},
        { remoteId: '9', dateUpdated: '2021-01-01T00:00:00Z' }
      ),
      rec('mediafile', 'c', {}, { dateUpdated: '2022-01-01T00:00:00Z' }),
      rec('mediafile', 'd', null, {
        remoteId: '8',
        dateUpdated: '2023-01-01T00:00:00Z',
      }),
    ] as unknown as BaseModel[];
    expect(dedupedChecksumRows(rows)).toEqual([
      { id: '9', num: isoToMillis('2020-01-01T00:00:00Z') },
      { id: '0', num: isoToMillis('2022-01-01T00:00:00Z') },
    ]);
  });
});

describe('maxUpdatedMillis', () => {
  it('is 0 for no rows', () => {
    expect(maxUpdatedMillis([])).toBe(0);
  });

  it('returns the newest dateUpdated millis', () => {
    expect(
      maxUpdatedMillis([
        { id: 'a', num: 10 },
        { id: 'b', num: 40 },
        { id: 'c', num: 20 },
      ])
    ).toBe(40);
  });
});

describe('rowsForSanityTable', () => {
  const rowsFor = (
    table: string,
    byType: Record<string, ReturnType<typeof rec>[]>,
    onUnknownTable?: (table: string) => void
  ) =>
    rowsForSanityTable({
      memory: memoryWith(byType),
      project,
      plan,
      table,
      onUnknownTable,
    }).map((row) => row.id);

  it('keeps section resource users on this plan only', () => {
    expect(
      rowsFor('sectionresourceuser', {
        section: [
          rec(
            'section',
            's1',
            { plan: link('plan', 'plan-1') },
            { remoteId: '10' }
          ),
          rec(
            'section',
            's2',
            { plan: link('plan', 'other') },
            { remoteId: '11' }
          ),
        ],
        sectionresource: [
          rec('sectionresource', 'sr1', { section: link('section', 's1') }),
          rec('sectionresource', 'sr2', { section: link('section', 's2') }),
        ],
        sectionresourceuser: [
          rec('sectionresourceuser', 'u1', {
            sectionresource: link('sectionresource', 'sr1'),
          }),
          rec('sectionresourceuser', 'u2', {
            sectionresource: link('sectionresource', 'sr2'),
          }),
        ],
      })
    ).toEqual(['u1']);
  });

  it('keeps scheme steps for schemes in this organization', () => {
    expect(
      rowsFor('organizationschemestep', {
        organizationscheme: [
          rec('organizationscheme', 'sch1', {
            organization: link('organization', 'org-1'),
          }),
          rec('organizationscheme', 'sch2', {
            organization: link('organization', 'org-2'),
          }),
        ],
        organizationschemestep: [
          rec('organizationschemestep', 'step1', {
            organizationscheme: link('organizationscheme', 'sch1'),
          }),
          rec('organizationschemestep', 'step2', {
            organizationscheme: link('organizationscheme', 'sch2'),
          }),
        ],
      })
    ).toEqual(['step1']);
  });

  it('keeps this org and shared artifact categories that have a remote id', () => {
    expect(
      rowsFor('artifactcategory', {
        artifactcategory: [
          rec(
            'artifactcategory',
            'mine',
            { organization: link('organization', 'org-1') },
            { remoteId: '1' }
          ),
          rec(
            'artifactcategory',
            'shared',
            { organization: { data: null } },
            { remoteId: '2' }
          ),
          rec(
            'artifactcategory',
            'other',
            { organization: link('organization', 'org-2') },
            { remoteId: '3' }
          ),
          rec('artifactcategory', 'local', {
            organization: link('organization', 'org-1'),
          }),
        ],
      })
    ).toEqual(['mine', 'shared']);
  });

  it('drops whole-table rows that have no remote id or no relationships', () => {
    expect(
      rowsFor('activitystate', {
        activitystate: [
          rec('activitystate', 'kept', {}, { remoteId: '1' }),
          rec('activitystate', 'local', {}),
          rec('activitystate', 'bare', null, { remoteId: '2' }),
        ],
      })
    ).toEqual(['kept']);
  });

  it('reports an unknown table and returns no rows', () => {
    const onUnknownTable = jest.fn();
    expect(rowsFor('nope', {}, onUnknownTable)).toEqual([]);
    expect(onUnknownTable).toHaveBeenCalledWith('nope');
  });
});
