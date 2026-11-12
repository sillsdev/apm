import { ISharedStrings } from '../model';

export const localizeRole = (role: string, ts: ISharedStrings): string => {
  const lcRole = role.toLowerCase();
  return ts.getString(lcRole) || lcRole;
};
