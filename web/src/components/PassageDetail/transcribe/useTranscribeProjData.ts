import { useEffect, useState } from 'react';
import Memory from '@orbit/memory';
import { Project } from '../../../model';
import { findRecord } from '../../../crud/tryFindRecord';
import {
  getFontData,
  loadFontData,
  type FontData,
} from '../../../crud/fontChoice';
import { resolveStepSpellCheck } from '../../../crud/stepSpellCheck';
import { parseStepLanguageField } from '../../../crud/transcribeStepAsrSettings';
import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';
import { isLangSet } from '../../../utils/langTag';
import { logError, Severity } from '../../../utils/logErrorService';
import { toError } from '../../../utils/toError';
import { useGlobal } from '../../../context/useGlobal';

/**
 * Font + spell-check for a transcribe pane from step settings (and project
 * vernacular fallback). One owner for Transcriber and mobile.
 */
export function useTranscribeProjData({
  project,
  memory,
  stepSettings,
  artifactTypeSlug,
  artifactId,
  availSpellLangs,
}: {
  project: string | undefined;
  memory: Memory;
  stepSettings: string;
  artifactTypeSlug: ArtifactTypeSlug | string | undefined;
  artifactId: string | null | undefined;
  availSpellLangs?: string[];
}) {
  const [errorReporter] = useGlobal('errorReporter');
  const [projData, setProjData] = useState<FontData>();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const lgSettings = JSON.parse(stepSettings || '{}') as {
          font?: string;
          fontSize?: string;
          rtl?: boolean;
          language?: unknown;
          spellCheck?: boolean;
        };
        const { bcp47: stepLang } = parseStepLanguageField(lgSettings.language);
        const hasStepLanguage = isLangSet(stepLang);

        const projRec = project
          ? (findRecord(memory, 'project', project) as Project | undefined)
          : undefined;

        let langTag = hasStepLanguage ? stepLang : undefined;
        let defaultFont = lgSettings.font;
        let rtl = lgSettings.rtl ?? false;
        let defaultFontSize = lgSettings.fontSize;
        const useProjectLang =
          artifactTypeSlug === ArtifactTypeSlug.Vernacular || !hasStepLanguage;
        if (useProjectLang && projRec) {
          langTag = projRec.attributes?.language ?? langTag;
          defaultFont =
            (defaultFont ?? projRec.attributes?.defaultFont) || undefined;
          rtl = projRec.attributes?.rtl ?? rtl;
          defaultFontSize =
            (defaultFontSize ?? projRec.attributes?.defaultFontSize) ||
            undefined;
        }

        const spellCheck = resolveStepSpellCheck(
          lgSettings,
          artifactTypeSlug,
          langTag,
          availSpellLangs
        );

        const fontKey = artifactId ?? 'project';
        const lastFontData = loadFontData(fontKey);
        defaultFontSize = lastFontData?.fontSize ?? defaultFontSize ?? 'large';

        const rec = {
          attributes: { language: langTag, defaultFont, defaultFontSize, rtl },
        } as Project;
        const data = await getFontData(rec, artifactId ?? fontKey);
        if (!cancelled) setProjData({ ...data, spellCheck });
      } catch (err) {
        if (cancelled) return;
        logError(Severity.error, errorReporter, toError(err));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    project,
    memory,
    stepSettings,
    artifactTypeSlug,
    artifactId,
    availSpellLangs,
    errorReporter,
  ]);

  return [projData, setProjData] as const;
}
