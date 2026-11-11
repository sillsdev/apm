export interface IStepRow {
  id: string;
  seq: number;
  name: string;
  pos: number;
  tool: string;
  settings: string;
  rIdx: number;
}

/** Persisted fields only — used to skip unchanged Orbit writes. */
export const rowSignature = (row: IStepRow) =>
  JSON.stringify({
    name: row.name,
    seq: row.seq,
    tool: row.tool,
    settings: row.settings,
  });
