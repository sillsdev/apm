import path from 'path-browserify';
import { MainAPI } from '@model/main-api';
import { resolvePathUnderRoot } from '../utils/resolvePathUnderRoot';
import { normalizeTextToUsfm } from './normalizeTextToUsfm';

type BurritoTextFormat = 'usfm' | 'usj' | 'usx';

function detectBurritoTextFormat(
  ingredientPath: string,
  mimeType: unknown
): BurritoTextFormat | null {
  const mt = String(mimeType ?? '')
    .trim()
    .toLowerCase();
  const ext = path.extname(String(ingredientPath ?? '')).toLowerCase();
  if (mt === 'text/usfm' || mt.startsWith('text/usfm') || ext === '.usfm') {
    return 'usfm';
  }
  if (
    mt === 'application/usx+xml' ||
    mt === 'application/xml' ||
    ext === '.usx' ||
    ext === '.xml'
  ) {
    return 'usx';
  }
  if (
    mt === 'application/usj+json' ||
    mt === 'application/json' ||
    ext === '.usj' ||
    ext === '.json'
  ) {
    return 'usj';
  }
  return null;
}

function toUsfmIngredientPath(inputPath: string): string {
  return inputPath.replace(/\.(usj|json|usx|xml)$/i, '.usfm');
}

type MinimalIpc = Pick<MainAPI, 'exists' | 'read' | 'write' | 'md5File'>;

/**
 * Renderer-only preprocessing step. Ensures the `textTranslation` burrito has
 * `text/usfm` ingredients even when exported as USJ/USX, so the Node migration
 * script can populate `mediafile.transcription`.
 */
export async function preprocessTextTranslationBurritoToUsfm(
  wrapperDir: string,
  ipcOverride?: MinimalIpc
): Promise<void> {
  const ipc = (ipcOverride ?? (window?.api as MainAPI)) as MinimalIpc;
  if (!ipc) return;

  const wrapperPath = resolvePathUnderRoot(wrapperDir, 'wrapper.json');
  if (!wrapperPath || !(await ipc.exists(wrapperPath))) return;

  const wrapperRaw = (await ipc.read(wrapperPath, { encoding: 'utf-8' })) as
    | string
    | Uint8Array;
  const wrapper = JSON.parse(String(wrapperRaw)) as any;
  const burritos: any[] = wrapper?.contents?.burritos ?? [];

  for (const burrito of burritos) {
    const burritoPath = String(burrito?.path ?? '');
    if (!burritoPath || burritoPath === 'apmdata') continue;

    const metaPath = resolvePathUnderRoot(
      wrapperDir,
      burritoPath,
      'metadata.json'
    );
    if (!metaPath || !(await ipc.exists(metaPath))) continue;
    const metaRaw = (await ipc.read(metaPath, { encoding: 'utf-8' })) as
      | string
      | Uint8Array;
    const meta = JSON.parse(String(metaRaw)) as any;

    const flavorName = meta?.type?.flavorType?.flavor?.name ?? null;
    if (flavorName !== 'textTranslation') continue;

    const ingredients: Record<string, any> = meta.ingredients ?? {};
    const generated: Record<string, any> = {};

    for (const [relPath, ing] of Object.entries(ingredients)) {
      const format = detectBurritoTextFormat(relPath, (ing as any)?.mimeType);
      if (format !== 'usj' && format !== 'usx') continue;

      const absPath = resolvePathUnderRoot(wrapperDir, burritoPath, relPath);
      if (!absPath || !(await ipc.exists(absPath))) continue;

      const raw = (await ipc.read(absPath, { encoding: 'utf-8' })) as
        | string
        | Uint8Array;
      const usfm = await normalizeTextToUsfm(String(raw), format);
      if (!usfm.trim()) continue;

      const usfmRel = toUsfmIngredientPath(relPath);
      const usfmAbs = resolvePathUnderRoot(wrapperDir, burritoPath, usfmRel);
      if (!usfmAbs) continue;
      await ipc.write(usfmAbs, usfm);

      generated[usfmRel] = {
        ...(ing as any),
        checksum: { md5: await ipc.md5File(usfmAbs) },
        mimeType: 'text/usfm',
        size: usfm.length,
        scope: (ing as any)?.scope,
      };
    }

    const generatedKeys = Object.keys(generated);
    if (generatedKeys.length === 0) continue;

    // Ensure the migration script (which picks the first `text/usfm` ingredient
    // per book scope) sees these generated USFM ingredients first.
    const reordered: Record<string, any> = {};
    for (const k of generatedKeys) reordered[k] = generated[k];
    for (const [k, v] of Object.entries(ingredients)) {
      if (!(k in reordered)) reordered[k] = v;
    }
    meta.ingredients = reordered;

    await ipc.write(metaPath, JSON.stringify(meta, null, 2));
  }
}
