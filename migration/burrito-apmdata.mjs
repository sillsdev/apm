/**
 * Load and remap ApmData burrito PTF JSON for burrito-to-ptf import.
 */

const APM_DATA_TABLE_FILES = {
  sections: 'F_sections.json',
  passages: 'G_passages.json',
  orgWorkflowSteps: 'C_orgworkflowsteps.json',
  plans: 'E_plans.json',
};

/**
 * @param {string} entryName
 * @returns {string}
 */
function normalizeEntryPath(entryName) {
  return String(entryName ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

/**
 * @param {import('./05-burrito-to-ptf.js').BurritoVirtualEntry[]} entries
 * @param {string} relativePath
 * @returns {Buffer | null}
 */
function readEntryBytes(entries, relativePath) {
  const target = normalizeEntryPath(relativePath);
  const direct = entries.find(
    (entry) =>
      !entry.isDirectory && normalizeEntryPath(entry.entryName) === target
  );
  if (direct) {
    return direct.getData();
  }
  const suffix = entries.find(
    (entry) =>
      !entry.isDirectory &&
      normalizeEntryPath(entry.entryName).endsWith(`/${target}`)
  );
  return suffix ? suffix.getData() : null;
}

/**
 * @param {Record<string, unknown>} metadata
 * @returns {string[]}
 */
export function listApmDataProjectFolders(metadata) {
  /** @type {Set<string>} */
  const folders = new Set();
  for (const key of Object.keys(metadata?.ingredients ?? {})) {
    const normalized = normalizeEntryPath(key);
    const match = normalized.match(/^([^/]+)\/data\/[A-Z]_/);
    if (match) {
      folders.add(match[1]);
    }
  }
  return [...folders];
}

/**
 * @param {Record<string, unknown>} metadata
 * @param {string | null | undefined} bookCode
 * @returns {string | null}
 */
export function selectApmDataProjectFolder(metadata, bookCode) {
  const folders = listApmDataProjectFolders(metadata);
  if (folders.length === 0) {
    return null;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  const book = String(bookCode ?? '')
    .trim()
    .toUpperCase();
  if (!book) {
    return folders[0];
  }
  for (const folder of folders) {
    for (const [key, ingredient] of Object.entries(
      metadata?.ingredients ?? {}
    )) {
      if (!normalizeEntryPath(key).startsWith(`${folder}/`)) {
        continue;
      }
      const scope = /** @type {{ scope?: Record<string, unknown> }} */ (
        ingredient
      ).scope;
      if (scope && Object.prototype.hasOwnProperty.call(scope, book)) {
        return folder;
      }
    }
  }
  return folders[0];
}

/**
 * @param {import('./05-burrito-to-ptf.js').BurritoVirtualEntry[]} entries
 * @param {string} projectFolder
 * @param {string} fileName
 * @returns {unknown[]}
 */
function readApmDataTable(entries, projectFolder, fileName) {
  const bytes = readEntryBytes(entries, `${projectFolder}/data/${fileName}`);
  if (!bytes) {
    return [];
  }
  const parsed = JSON.parse(bytes.toString('utf-8'));
  return Array.isArray(parsed?.data) ? parsed.data : [];
}

/**
 * @param {import('./05-burrito-to-ptf.js').BurritoVirtualEntry[]} entries
 * @param {Record<string, unknown>} metadata
 * @param {string | null | undefined} bookCode
 * @returns {{
 *   projectFolder: string;
 *   sections: unknown[];
 *   passages: unknown[];
 *   orgWorkflowSteps: unknown[];
 * } | null}
 */
export function loadApmDataSnapshot(entries, metadata, bookCode) {
  const projectFolder = selectApmDataProjectFolder(metadata, bookCode);
  if (!projectFolder) {
    return null;
  }
  const sections = readApmDataTable(
    entries,
    projectFolder,
    APM_DATA_TABLE_FILES.sections
  );
  const passages = readApmDataTable(
    entries,
    projectFolder,
    APM_DATA_TABLE_FILES.passages
  );
  const orgWorkflowSteps = readApmDataTable(
    entries,
    projectFolder,
    APM_DATA_TABLE_FILES.orgWorkflowSteps
  );
  if (
    sections.length === 0 &&
    passages.length === 0 &&
    orgWorkflowSteps.length === 0
  ) {
    return null;
  }
  return { projectFolder, sections, passages, orgWorkflowSteps };
}

/**
 * @param {unknown} record
 * @param {string} relName
 * @returns {string | null}
 */
function relIdNamed(record, relName) {
  const rel = /** @type {{ data?: { id?: string } }} */ (
    record?.relationships?.[relName]
  );
  return typeof rel?.data?.id === 'string' ? rel.data.id : null;
}

/**
 * @param {unknown} record
 * @param {string} relName
 * @param {{ type: string; id: string } | null} target
 */
function setRel(record, relName, target) {
  if (!record || typeof record !== 'object') {
    return;
  }
  const rels = /** @type {Record<string, unknown>} */ (record);
  if (!rels.relationships || typeof rels.relationships !== 'object') {
    rels.relationships = {};
  }
  const relationships = /** @type {Record<string, unknown>} */ (
    rels.relationships
  );
  relationships[relName] = target
    ? { data: { type: target.type, id: target.id } }
    : { data: null };
}

/**
 * @param {{
 *   sections: unknown[];
 *   passages: unknown[];
 *   orgWorkflowSteps: unknown[];
 * }} snapshot
 * @param {{
 *   generateId: () => string;
 *   createdAt: string;
 *   user: { id: string };
 *   organization: { id: string };
 *   plan: { id: string };
 * }} context
 * @returns {{
 *   sections: unknown[];
 *   passages: unknown[];
 *   orgWorkflowSteps: unknown[];
 * }}
 */
export function remapApmDataSnapshot(snapshot, context) {
  const { generateId, createdAt, user, organization, plan } = context;
  /** @type {Map<string, string>} */
  const idMap = new Map();

  const cloneWithNewIds = (records) =>
    records.map((record) => {
      const source = /** @type {{ id?: string }} */ (record);
      const oldId = source.id;
      const nextId = generateId();
      if (oldId) {
        idMap.set(oldId, nextId);
      }
      return {
        ...source,
        id: nextId,
        attributes: {
          ...(source.attributes ?? {}),
          dateCreated: createdAt,
          dateUpdated: createdAt,
          'date-created': createdAt,
          'date-updated': createdAt,
        },
        relationships: { ...(source.relationships ?? {}) },
      };
    });

  const orgWorkflowSteps = cloneWithNewIds(snapshot.orgWorkflowSteps).map(
    (step) => {
      setRel(step, 'lastModifiedByUser', { type: 'user', id: user.id });
      setRel(step, 'organization', {
        type: 'organization',
        id: organization.id,
      });
      return step;
    }
  );

  const sections = cloneWithNewIds(snapshot.sections).map((section) => {
    setRel(section, 'lastModifiedByUser', { type: 'user', id: user.id });
    setRel(section, 'plan', { type: 'plan', id: plan.id });
    const passageRels =
      /** @type {{ data?: Array<{ id?: string; type?: string }> }} */ (
        section.relationships?.passages
      )?.data ?? [];
    section.relationships.passages = {
      data: passageRels
        .map((item) => {
          const mapped = item?.id ? idMap.get(item.id) : null;
          return mapped ? { type: 'passage', id: mapped } : null;
        })
        .filter(Boolean),
    };
    return section;
  });

  const passages = cloneWithNewIds(snapshot.passages).map((passage) => {
    setRel(passage, 'lastModifiedByUser', { type: 'user', id: user.id });
    const sectionId = relIdNamed(passage, 'section');
    if (sectionId && idMap.has(sectionId)) {
      setRel(passage, 'section', {
        type: 'section',
        id: idMap.get(sectionId),
      });
    }
    passage.relationships.mediafiles = { data: [] };
    return passage;
  });

  return { sections, passages, orgWorkflowSteps };
}

export { APM_DATA_TABLE_FILES };
