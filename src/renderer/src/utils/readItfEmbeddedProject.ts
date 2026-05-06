import JSZip from 'jszip';

export interface ItfEmbeddedProject {
  id: string;
  name: string;
}

const PROJECTS_JSON_PATH = 'data/D_projects.json';

/**
 * Reads the embedded project record from `data/D_projects.json` inside an ITF (zip).
 * Returns null if the ITF doesn't contain the expected file/shape.
 */
export async function readItfEmbeddedProject(
  file: File
): Promise<ItfEmbeddedProject | null> {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file(PROJECTS_JSON_PATH);
  if (!entry) return null;

  const text = await entry.async('text');
  const json = JSON.parse(text) as {
    data?: Array<{ id?: string | number; attributes?: { name?: string } }>;
  };

  const first = json.data?.[0];
  const id = first?.id;
  if (id === undefined || id === null) return null;

  return {
    id: String(id),
    name: first?.attributes?.name?.trim() ?? '',
  };
}

