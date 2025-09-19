import { IGridStrings } from '../model';

interface LocalizeGridResult {
  localizeFilter: {
    filterPlaceholder: string;
    contains: string;
    notContains: string;
    startsWith: string;
    endsWith: string;
    equal: string;
    notEqual: string;
    greaterThan: string;
    greaterThanOrEqual: string;
    lessThan: string;
    lessThanOrEqual: string;
  };
  localizePaging: {
    showAll: string;
    rowsPerPage: string;
    info: (parameters: { from: number; to: number; count: number }) => string;
  };
  localizeRowSummary: {
    avg: string;
    count: string;
    max: string;
    min: string;
    sum: string;
  };
  localizeGroupingPanel: {
    groupByColumn: string;
  };
  localizeTableMessages: {
    noData: string;
  };
}

export const localizeGrid = (t: IGridStrings): LocalizeGridResult => {
  const localizeFilter = {
    filterPlaceholder: t.filterPlaceholder,
    contains: t.contains,
    notContains: t.notcontains,
    startsWith: t.startsWith,
    endsWith: t.endsWith,
    equal: t.equal,
    notEqual: t.notEqual,
    greaterThan: t.greaterThan,
    greaterThanOrEqual: t.greaterThanOrEqual,
    lessThan: t.lessThan,
    lessThanOrEqual: t.lessThanOrEqual,
  };

  const localizePaging = {
    showAll: t.all,
    rowsPerPage: t.rowsPerPage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    info: (parameters: { from: number; to: number; count: number }) =>
      t.pageInfo,
  };

  const localizeRowSummary = {
    avg: t.avg,
    count: t.count,
    max: t.max,
    min: t.min,
    sum: t.sum,
  };

  const localizeGroupingPanel = {
    groupByColumn: t.groupByColumn,
  };

  const localizeTableMessages = {
    noData: t.noData,
  };

  return {
    localizeFilter,
    localizeGroupingPanel,
    localizePaging,
    localizeRowSummary,
    localizeTableMessages,
  };
};
