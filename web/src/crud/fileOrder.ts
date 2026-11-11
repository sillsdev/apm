export interface fileInfo {
  table: string;
  sort: string;
}

export const updateableFiles = [
  { table: 'comment', sort: 'J' },
  { table: 'discussion', sort: 'I' },
  { table: 'groupmembership', sort: 'D' },
  { table: 'intellectualproperty', sort: 'I' },
  { table: 'mediafile', sort: 'H' },
  { table: 'mediareplacement', sort: 'I' },
  { table: 'orgkeyterm', sort: 'C' },
  { table: 'orgkeytermreference', sort: 'H' },
  { table: 'orgkeytermtarget', sort: 'I' },
  { table: 'passage', sort: 'G' },
  { table: 'passagestatechange', sort: 'H' },
  { table: 'project', sort: 'D' },
  { table: 'section', sort: 'F' },
  { table: 'sectionresourceuser', sort: 'J' },
  { table: 'user', sort: 'A' },
] as const satisfies readonly fileInfo[];

/* If these can change in electron, they must extend BaseModel instead of Record,
      call UpdateRecord instead of t.updateRecord, and be moved up to the files array */
export const staticFiles = [
  { table: 'activitystate', sort: 'B' },
  { table: 'artifactcategory', sort: 'C' },
  { table: 'artifacttype', sort: 'C' },
  { table: 'bible', sort: 'I' },
  { table: 'graphic', sort: 'I' },
  { table: 'group', sort: 'C' },
  { table: 'integration', sort: 'B' },
  { table: 'invitation', sort: 'D' },
  { table: 'organizationbible', sort: 'I' },
  { table: 'organization', sort: 'B' },
  { table: 'organizationmembership', sort: 'C' },
  { table: 'organizationscheme', sort: 'C' },
  { table: 'organizationschemestep', sort: 'D' },
  { table: 'orgworkflowstep', sort: 'C' },
  { table: 'passagetype', sort: 'B' },
  { table: 'plan', sort: 'E' },
  { table: 'plantype', sort: 'B' },
  { table: 'projectintegration', sort: 'E' }, //do we care that they synced locally??
  { table: 'projecttype', sort: 'B' },
  { table: 'role', sort: 'B' },
  { table: 'sectionresource', sort: 'I' },
  { table: 'sharedresource', sort: 'I' },
  { table: 'sharedresourcereference', sort: 'J' },
  { table: 'workflowstep', sort: 'B' },
] as const satisfies readonly fileInfo[];

/** Every table that sync and the sanity check walk; a new entry above extends it. */
export type SyncTable =
  | (typeof updateableFiles)[number]['table']
  | (typeof staticFiles)[number]['table'];

export const localFiles = [
  { table: 'offlineproject', sort: 'K' },
  { table: 'audacityproject', sort: 'K' },
];
