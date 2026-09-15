import { useRef, useState } from 'react';
import { useGlobal } from '../context/useGlobal';
import {
  IState,
  IArtifactCategoryStrings,
  ArtifactCategory,
  ArtifactCategoryD,
  Organization,
} from '../model';
import { RecordOperation, RecordTransformBuilder } from '@orbit/records';
import localStrings from '../selector/localize';
import { useSelector, shallowEqual } from 'react-redux';
import { related } from './related';
import { findRecord } from './tryFindRecord';
import {
  AddRecord,
  ReplaceRelatedRecord,
  UpdateRecord,
} from '../model/baseModel';
import { cleanFileName } from '../utils/cleanFileName';
import { useWaitForRemoteQueue } from '../utils/useWaitForRemoteQueue';
import { logError, Severity } from '../utils/logErrorService';
import { pickSpecialWinner } from './pickArtifactCategorySpecial';

interface ISwitches {
  [key: string]: any;
}
export interface IArtifactCategory {
  slug: string;
  category: string;
  org: string;
  id: string;
  titleMediaId: string;
  color: string;
  specialuse: string;
}
export enum ArtifactCategoryType {
  Resource = 'resource',
  Discussion = 'discussion',
  Note = 'note',
}
const stringSelector = (state: IState) =>
  localStrings(state as IState, { layout: 'artifactCategory' });

export const useArtifactCategory = (teamId?: string) => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [organization] = useGlobal('organization');
  const curOrg = teamId ?? organization;
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [errorReporter] = useGlobal('errorReporter');
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const t: IArtifactCategoryStrings = useSelector(stringSelector, shallowEqual);
  const [fromLocal] = useState<ISwitches>({});
  const specialNoteCategories = ['chapter', 'title'];
  // Ensure chapter/title bootstrap runs at most once per org per successful attempt.
  const specialBootstrapOrgs = useRef<Set<string>>(new Set());
  // Coalesce concurrent consolidates; cleared after settle so later dups re-run.
  const specialConsolidateInFlight = useRef<
    Map<string, Promise<ArtifactCategoryD[]>>
  >(new Map());
  const localizedArtifactCategory = (val: string) => {
    return (t as ISwitches)[val] || val;
  };

  const fromLocalizedArtifactCategory = (val: string) => {
    if (Object.entries(fromLocal).length === 0) {
      for (const [key, value] of Object.entries(t)) {
        fromLocal[value] = key;
      }
    }
    return fromLocal[val] || val;
  };

  const slugFromId = (id: string) => {
    let aRec = {} as ArtifactCategory;
    if (id)
      aRec = findRecord(memory, 'artifactcategory', id) as ArtifactCategory;
    return aRec?.attributes?.categoryname ?? '';
  };

  const defaultMediaName = (name: string) => {
    const orgRec = findRecord(memory, 'organization', curOrg) as Organization;
    return cleanFileName(orgRec?.attributes?.slug + 'cat' + name) ?? '';
  };

  const noteSpecialsPresent = (recs: ArtifactCategoryD[]) => {
    const present = new Set<string>();
    for (const r of recs) {
      if (!r.attributes?.note) continue;
      const su = r.attributes.specialuse ?? '';
      if (su) present.add(su);
    }
    return present;
  };

  const AddOrgNoteCategoryOps = (
    t: RecordTransformBuilder,
    orgId?: string,
    onlySpecials?: string[]
  ) => {
    if (offlineOnly) return [];
    // Add default note categories (or only the missing specialuses when bootstrapping).

    const toAdd = onlySpecials ?? specialNoteCategories;
    const opArray: RecordOperation[] = [];
    toAdd.forEach((category) => {
      const noteCategory: ArtifactCategoryD = {
        type: 'artifactcategory',
        attributes: {
          specialuse: category,
          categoryname: localizedArtifactCategory(category),
          discussion: false,
          resource: false,
          note: true,
        },
      } as ArtifactCategoryD;
      opArray.push(
        ...[
          ...AddRecord(t, noteCategory, user, memory),
          ...ReplaceRelatedRecord(
            t,
            noteCategory,
            'organization',
            'organization',
            orgId ?? curOrg
          ),
        ]
      );
    });
    return opArray;
  };

  const AddOrgNoteCategories = async (
    orgId?: string,
    onlySpecials?: string[]
  ) => {
    if (offlineOnly) return;
    // Add default note categories

    await memory.update((t) => AddOrgNoteCategoryOps(t, orgId, onlySpecials));
  };

  /**
   * When the team has its own specialuse note category, omit system (org null)
   * rows with that specialuse from the returned list — display override only.
   */
  const hideSystemOverriddenByTeam = (recs: ArtifactCategoryD[]) => {
    const teamSpecials = new Set<string>();
    for (const r of recs) {
      const org = related(r, 'organization');
      const su = r.attributes?.specialuse ?? '';
      if (org && su) teamSpecials.add(su);
    }
    return recs.filter((r) => {
      const org = related(r, 'organization');
      const su = r.attributes?.specialuse ?? '';
      if (org == null && su && teamSpecials.has(su)) return false;
      return true;
    });
  };

  /**
   * Hide-only filtering left unreachable specials that notes / CHNUM still
   * reference by id (Devin). Migrate refs to a canonical winner, copy empty
   * winner settings from losers (color / titleMedia / category graphic), remove
   * local-only losers, then return the cleaned note list.
   *
   * Only consolidates within the same non-empty organization — never deletes
   * system (org null) categories or groups them with team specials.
   * Synced losers (remoteId) are hidden but not removeRecord'd so uncached
   * server refs remain valid.
   */
  const consolidateDuplicateNoteSpecials = async (
    noteRecs: ArtifactCategoryD[]
  ): Promise<ArtifactCategoryD[]> => {
    if (!curOrg) return noteRecs;

    // Partition by organization + specialuse so team and system never pair.
    const byOrgSpecial = new Map<string, ArtifactCategoryD[]>();
    for (const r of noteRecs) {
      const su = r.attributes?.specialuse ?? '';
      if (!su) continue;
      const org = related(r, 'organization') ?? '';
      // System categories (org '') are never consolidate losers/winners.
      if (!org) continue;
      const key = `${org}::${su}`;
      const list = byOrgSpecial.get(key) ?? [];
      list.push(r);
      byOrgSpecial.set(key, list);
    }

    const pairs: { winner: ArtifactCategoryD; loser: ArtifactCategoryD }[] = [];
    for (const group of byOrgSpecial.values()) {
      if (group.length < 2) continue;
      const winner = pickSpecialWinner(group);
      for (const r of group) {
        if (r.id !== winner.id) pairs.push({ winner, loser: r });
      }
    }

    // Hide every loser from the returned list (removed local-only and retained synced).
    const filterLosers = (recs: ArtifactCategoryD[]) => {
      const loserIds = new Set(pairs.map((p) => p.loser.id));
      return recs.filter((r) => !loserIds.has(r.id));
    };

    const applyPatches = (
      recs: ArtifactCategoryD[],
      patches: Map<string, ArtifactCategoryD>
    ) => recs.map((r) => patches.get(r.id) ?? r);

    if (pairs.length === 0) {
      return hideSystemOverriddenByTeam(noteRecs);
    }

    const inflight = specialConsolidateInFlight.current.get(curOrg);
    if (inflight) return inflight;

    const run = (async (): Promise<ArtifactCategoryD[]> => {
      const patchedWinners = new Map<string, ArtifactCategoryD>();
      try {
        await memory.update((t: RecordTransformBuilder) => {
          const ops: RecordOperation[] = [];
          const refTypes = [
            'sharedresource',
            'mediafile',
            'discussion',
          ] as const;
          const graphics = memory.cache.query((q) =>
            q.findRecords('graphic')
          ) as {
            id: string;
            type: string;
            attributes?: { resourceType?: string; resourceId?: number };
          }[];
          // Track winners that receive a graphic in this transform so multiple
          // losers do not all re-key onto the same remoteId.
          const winnersGivenGraphic = new Set<number>();

          for (const { winner, loser } of pairs) {
            // Never delete system categories (defense in depth).
            if (related(loser, 'organization') == null) continue;

            let patched = patchedWinners.get(winner.id) ?? winner;

            // Fill empty winner settings from loser (keep winner on conflicts).
            const winnerColor = patched.attributes?.color ?? '';
            const loserColor = loser.attributes?.color ?? '';
            if (!winnerColor && loserColor) {
              patched = {
                ...patched,
                attributes: {
                  ...patched.attributes,
                  color: loserColor,
                },
              } as ArtifactCategoryD;
              patchedWinners.set(winner.id, patched);
              ops.push(...UpdateRecord(t, patched, user));
            }
            const winnerTitle = related(patched, 'titleMediafile');
            const loserTitle = related(loser, 'titleMediafile');
            if (!winnerTitle && loserTitle) {
              patched = {
                ...patched,
                relationships: {
                  ...patched.relationships,
                  titleMediafile: {
                    data: { type: 'mediafile', id: loserTitle },
                  },
                },
              } as ArtifactCategoryD;
              patchedWinners.set(winner.id, patched);
              ops.push(
                ...ReplaceRelatedRecord(
                  t,
                  patched,
                  'titleMediafile',
                  'mediafile',
                  loserTitle
                )
              );
            }

            // Re-key at most one category graphic onto the winner remoteId.
            const loserRemote = loser.keys?.remoteId;
            const winnerRemote = winner.keys?.remoteId;
            if (loserRemote && winnerRemote) {
              const loserRid = parseInt(String(loserRemote), 10);
              const winnerRid = parseInt(String(winnerRemote), 10);
              const winnerHasGraphic =
                winnersGivenGraphic.has(winnerRid) ||
                graphics.some(
                  (g) =>
                    g.attributes?.resourceType === 'category' &&
                    g.attributes?.resourceId === winnerRid
                );
              if (!winnerHasGraphic && !Number.isNaN(loserRid)) {
                const loserGraphic = graphics.find(
                  (g) =>
                    g.attributes?.resourceType === 'category' &&
                    g.attributes?.resourceId === loserRid
                );
                if (loserGraphic && !Number.isNaN(winnerRid)) {
                  winnersGivenGraphic.add(winnerRid);
                  ops.push(
                    ...UpdateRecord(
                      t,
                      {
                        ...loserGraphic,
                        attributes: {
                          ...loserGraphic.attributes,
                          resourceId: winnerRid,
                        },
                      } as unknown as Parameters<typeof UpdateRecord>[1],
                      user
                    )
                  );
                }
              }
            }

            for (const type of refTypes) {
              const refs = (
                memory.cache.query((q) => q.findRecords(type)) as {
                  id: string;
                  type: string;
                  relationships?: unknown;
                }[]
              ).filter((r) => related(r, 'artifactCategory') === loser.id);
              for (const ref of refs) {
                ops.push(
                  ...ReplaceRelatedRecord(
                    t,
                    ref as Parameters<typeof ReplaceRelatedRecord>[1],
                    'artifactCategory',
                    'artifactcategory',
                    winner.id
                  )
                );
              }
            }
            // Local-only losers: cache scan is exhaustive — safe to delete.
            // Synced losers may have unloaded server refs — keep the row.
            if (!loser.keys?.remoteId) {
              ops.push(
                t
                  .removeRecord({ type: 'artifactcategory', id: loser.id })
                  .toOperation()
              );
            }
          }
          return ops;
        });
        return hideSystemOverriddenByTeam(
          applyPatches(filterLosers(noteRecs), patchedWinners)
        );
      } catch (err) {
        logError(Severity.error, errorReporter, err as Error);
        // Do not hide losers still present in the cache.
        return hideSystemOverriddenByTeam(noteRecs);
      } finally {
        specialConsolidateInFlight.current.delete(curOrg);
      }
    })();

    specialConsolidateInFlight.current.set(curOrg, run);
    return run;
  };

  const getArtifactCategorys = async (type: ArtifactCategoryType) => {
    const categorys: IArtifactCategory[] = [];
    // Read from the local Orbit cache only. Waiting on the remote request
    // queue here stalled the Note Details picker for whole seconds whenever
    // any mid-session sync work was still draining (TT-7656).
    const allOrgRecs: ArtifactCategoryD[] = (
      memory?.cache.query((q) =>
        q.findRecords('artifactcategory')
      ) as ArtifactCategoryD[]
    ).filter(
      (r) =>
        Boolean(r.relationships) &&
        (related(r, 'organization') === curOrg ||
          related(r, 'organization') === null)
    );
    let orgrecs: ArtifactCategoryD[] = allOrgRecs.filter(
      (r) => Boolean(r.keys?.remoteId) !== offlineOnly
    );
    if (!offlineOnly && type === ArtifactCategoryType.Note && curOrg) {
      // Detect specials against unfiltered cache so an unsynced local special
      // (no remoteId yet) still counts and is not created again (TT-7656).
      // Create each missing specialuse individually so chapter-only orgs still
      // get title (TT-7702).
      const present = noteSpecialsPresent(allOrgRecs);
      const missing = specialNoteCategories.filter((s) => !present.has(s));
      if (missing.length > 0 && !specialBootstrapOrgs.current.has(curOrg)) {
        specialBootstrapOrgs.current.add(curOrg);
        // Fire-and-forget: liveQuery refreshes the picker when records land,
        // and specials are filtered out of the dropdown anyway. On failure,
        // clear the marker so a later read can retry.
        void AddOrgNoteCategories(curOrg, missing).catch((err: Error) => {
          specialBootstrapOrgs.current.delete(curOrg);
          logError(Severity.error, errorReporter, err);
        });
      }
    }

    if (type === ArtifactCategoryType.Resource)
      orgrecs = orgrecs.filter((r) => r.attributes.resource);
    else if (type === ArtifactCategoryType.Discussion)
      orgrecs = orgrecs.filter((r) => r.attributes.discussion);
    else if (type === ArtifactCategoryType.Note) {
      // Consolidate against unfiltered org notes so an unsynced loser (no
      // remoteId) is still migrated/removed, not merely omitted from the list.
      const consolidated = await consolidateDuplicateNoteSpecials(
        allOrgRecs.filter((r) => r.attributes.note)
      );
      orgrecs = consolidated.filter(
        (r) => Boolean(r.keys?.remoteId) !== offlineOnly
      );
    }

    orgrecs.forEach((r) =>
      categorys.push({
        slug: r.attributes.categoryname,
        category: localizedArtifactCategory(r.attributes?.categoryname),
        org: related(r, 'organization') ?? '',
        id: r.id,
        titleMediaId: related(r, 'titleMediafile') ?? '',
        color: r.attributes?.color ?? '',
        specialuse: r.attributes?.specialuse ?? '',
      })
    );
    return categorys;
  };

  const isDuplicateCategory = async (
    newArtifactCategory: string,
    type: ArtifactCategoryType,
    id?: string
  ) => {
    //check for duplicate
    const orgrecs: ArtifactCategory[] = memory?.cache.query((q) =>
      q
        .findRecords('artifactcategory')
        .filter({ attribute: 'categoryname', value: newArtifactCategory })
    ) as any;
    let dup = false;
    orgrecs.forEach((r) => {
      const org = related(r, 'organization');
      if ((org === curOrg || !org) && r.id !== id) dup = true;
    });
    if (dup) return true;
    //now check duplicate localized
    const ac = (await getArtifactCategorys(type)).filter(
      (c) => c.category === newArtifactCategory
    );
    if (ac.length > 0 && ac[0].id !== id) return true;
    return false;
  };

  const addNewArtifactCategory = async (
    newArtifactCategory: string,
    type: ArtifactCategoryType,
    titleMedia?: string,
    color?: string
  ) => {
    const defaultColor = '#ed071d';
    if (!/^\s*$/.test(newArtifactCategory)) {
      if (await isDuplicateCategory(newArtifactCategory, type))
        return 'duplicate';

      const artifactCategory: ArtifactCategoryD = {
        type: 'artifactcategory',
        attributes: {
          categoryname: newArtifactCategory,
          resource: type === ArtifactCategoryType.Resource,
          discussion: type === ArtifactCategoryType.Discussion,
          note: type === ArtifactCategoryType.Note,
          color:
            (color ?? type === ArtifactCategoryType.Note) ? defaultColor : '',
        },
      } as any;
      const t = new RecordTransformBuilder();
      let ops = [
        ...AddRecord(t, artifactCategory, user, memory),
        ...ReplaceRelatedRecord(
          t,
          artifactCategory,
          'organization',
          'organization',
          curOrg
        ),
      ];
      if (titleMedia) {
        ops = [
          ...ops,
          ...ReplaceRelatedRecord(
            t,
            artifactCategory,
            'titleMediafile',
            'mediafile',
            titleMedia
          ),
        ];
      }
      await memory.update(ops);
      // Wait here (not on read) so keys.remoteId can fill in before callers
      // that need a synced id continue. A stuck queue must not blank the list.
      try {
        await waitForRemoteQueue('category update');
      } catch {
        /* ignore — create already persisted locally */
      }
      return artifactCategory.id;
    }
    return undefined;
  };
  const updateArtifactCategory = async (category: IArtifactCategory) => {
    const rec = findRecord(
      memory,
      'artifactcategory',
      category.id
    ) as ArtifactCategoryD;
    if (rec) {
      const t = new RecordTransformBuilder();
      let ops = [
        ...UpdateRecord(
          t,
          {
            ...rec,
            attributes: {
              ...rec.attributes,
              categoryname: category.category,
              color: category?.color,
            },
          } as ArtifactCategoryD,
          user
        ),
      ];
      if (category.titleMediaId) {
        ops = [
          ...ops,
          ...ReplaceRelatedRecord(
            t,
            rec,
            'titleMediafile',
            'mediafile',
            category.titleMediaId
          ),
        ];
      }
      await memory.update(ops);
    }
  };
  const scriptureTypeCategory = (cat: string) => {
    return ['scripture', 'biblestory'].includes(
      fromLocalizedArtifactCategory(cat)
    );
  };

  return {
    getArtifactCategorys,
    isDuplicateCategory,
    addNewArtifactCategory,
    updateArtifactCategory,
    localizedArtifactCategory,
    fromLocalizedArtifactCategory,
    scriptureTypeCategory,
    slugFromId,
    defaultMediaName,
    AddOrgNoteCategoryOps,
  };
};
