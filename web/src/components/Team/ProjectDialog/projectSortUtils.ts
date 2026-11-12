import { ProjectD } from '../../../model';

export type SortArr = [string, number][];
export type SortMap = Map<string, number>;

export const mapKey = (p: ProjectD) => p?.keys?.remoteId || p?.id;
export const getKey = (p: ProjectD, map: SortMap) =>
  mapKey(p) ? map.get(mapKey(p)) : undefined;

/** A plan on the Team screen with the project values the sort reads. */
export interface ProjectSortItem<T> {
  item: T;
  project?: ProjectD;
  /** Project book default (projDefBook), e.g. A01 for Genesis. */
  book?: string;
  name?: string;
}

const noPlan = 'Zxx';

type Keyed<T> = ProjectSortItem<T> & { key: string; index?: number };

const byKey = <T>(i: Keyed<T>, j: Keyed<T>) =>
  i.key !== j.key
    ? i.key.localeCompare(j.key)
    : (i.name?.trim() ?? '').localeCompare(j.name?.trim() ?? '');

/**
 * Order team projects by the saved manual order. A project missing from that
 * order (e.g. added after it was saved) goes before the first project with a
 * later book, so new projects still land in book order (TT-7820).
 */
export const sortProjects = <T>(
  items: ProjectSortItem<T>[],
  map: SortMap
): T[] => {
  const keyed: Keyed<T>[] = items.map((s) => ({
    ...s,
    key: s.book ?? s.name ?? noPlan,
    index: s.project ? getKey(s.project, map) : undefined,
  }));
  const result = keyed
    .filter((s) => s.index !== undefined)
    .sort((i, j) =>
      i.index !== j.index ? (i.index ?? 0) - (j.index ?? 0) : byKey(i, j)
    );
  keyed
    .filter((s) => s.index === undefined)
    .sort(byKey)
    .forEach((s) => {
      const at = result.findIndex((r) => byKey(s, r) < 0);
      result.splice(at < 0 ? result.length : at, 0, s);
    });
  return result.map((s) => s.item);
};
