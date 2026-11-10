import Memory from '@orbit/memory';
import { OrgWorkflowStep, OrgWorkflowStepD } from '../../model';
import { AddRecord, ReplaceRelatedRecord } from '../../model/baseModel';
import { defaultWorkflow } from '../../crud/defaultWorkflow';
import { IStepRow, rowSignature } from './stepRow';

export type MangleStepName = (
  name: string,
  orgNames: string[],
  index?: number,
  mangleTranscribe?: boolean
) => string;

export interface SaveOrgWorkflowStepsArgs {
  rows: IStepRow[];
  org: string;
  process?: string;
  memory: Memory;
  user: string;
  baseline: Map<string, string>;
  mangleName: MangleStepName;
  getOrgNames: (exceptId?: string) => string[];
}

/**
 * Writes changed/new org workflow steps to Orbit. Skips rows whose signature
 * still matches `baseline`. Updates `baseline` for existing ids on success.
 * Returns how many records were written.
 */
export async function saveOrgWorkflowSteps({
  rows,
  org,
  process,
  memory,
  user,
  baseline,
  mangleName,
  getOrgNames,
}: SaveOrgWorkflowStepsArgs): Promise<number> {
  const orgNames = new Set<string>();
  let count = 0;
  for (let ix = 0; ix < rows.length; ix += 1) {
    const row = rows[ix];
    const id = row.id;
    const tool = JSON.stringify({
      tool: row.tool,
      settings: row.settings,
    });
    if (id) {
      const prev = baseline.get(id);
      if (prev !== undefined && prev === rowSignature(row)) {
        // Unchanged (name, sequence, tool, settings) — skip the write.
        continue;
      }
      const recId = { type: 'orgworkflowstep', id };
      const rec = memory.cache.query((q) => q.findRecord(recId)) as
        OrgWorkflowStep | undefined;

      if (rec) {
        let name = rec.attributes?.name;
        if (name !== row.name) {
          name = mangleName(
            row.name,
            getOrgNames(id).concat(Array.from(orgNames)),
            ix,
            false
          );
          orgNames.add(name);
        }
        if (
          name !== rec.attributes?.name ||
          row.seq !== rec.attributes?.sequencenum ||
          tool !== rec.attributes?.tool
        ) {
          await memory.update((t) =>
            t.updateRecord({
              ...rec,
              attributes: {
                ...rec.attributes,
                name,
                sequencenum: row.seq,
                tool: tool,
              },
            })
          );
          count += 1;
        }
      }
    } else {
      const name = mangleName(
        row.name,
        getOrgNames().concat(Array.from(orgNames)),
        ix,
        false
      );
      const rec = {
        type: 'orgworkflowstep',
        attributes: {
          sequencenum: row.seq,
          name,
          process: process || defaultWorkflow,
          tool: tool,
          permissions: '{}',
        },
      } as OrgWorkflowStep;
      if (org) {
        await memory.update((t) => [
          ...AddRecord(t, rec, user, memory),
          ...ReplaceRelatedRecord(
            t,
            rec as OrgWorkflowStepD,
            'organization',
            'organization',
            org
          ),
        ]);
      }
      count += 1;
    }
  }
  rows.forEach((row) => {
    if (row.id) baseline.set(row.id, rowSignature(row));
  });
  return count;
}
