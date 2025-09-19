import { ProjectD } from '../../../model';

export type SortArr = [string, number][];
export type SortMap = Map<string, number>;

export const mapKey = (p: ProjectD) => p.keys?.remoteId || p.id;
export const getKey = (p: ProjectD, map: SortMap) => map.get(mapKey(p));
