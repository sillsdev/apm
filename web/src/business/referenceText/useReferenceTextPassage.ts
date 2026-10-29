import { useEffect, useState } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { projDefReferenceTexts } from '../../crud/useProjectDefaults';
import { useOrbitData } from '../../hoc/useOrbitData';
import { PassageD, ProjectD } from '../../model';
import { logError, Severity } from '../../utils/logErrorService';
import { useJsonParams } from '../../utils/useJsonParams';
import {
  chaptersInRange,
  passageText,
  planPassage,
  ReferenceTextError,
} from './passageText';
import { parseReferenceTexts, ReferenceText } from './referenceText';
import { getChapters } from './referenceTextChapters';

export type ReferenceTextRole = 'primary' | 'secondary';

export type ReferenceTextPassage =
  | { status: 'none' }
  | { status: 'loading'; referenceText: ReferenceText }
  | { status: 'ready'; referenceText: ReferenceText; text: string }
  | {
      status: 'error';
      referenceText: ReferenceText;
      error: ReferenceTextError;
      /** Fetches again; only for `fetchFailed`, the one error a new attempt can fix. */
      retry?: () => void;
    };

// defaultParams.referenceTexts is ordered Primary then Secondary (ADR 0014)
const roleIndex: Record<ReferenceTextRole, number> = {
  primary: 0,
  secondary: 1,
};

type FetchResult = { key: string } & (
  { text: string } | { error: ReferenceTextError }
);

/**
 * The passage's verse range read from the current project's Primary or
 * Secondary Reference Text, as one string ready for text-to-speech.
 */
export const useReferenceTextPassage = (
  passage: PassageD | undefined,
  role: ReferenceTextRole
): ReferenceTextPassage => {
  const [projectId] = useGlobal('project');
  const [errorReporter] = useGlobal('errorReporter');
  const projects = useOrbitData<ProjectD[]>('project');
  const { getParam } = useJsonParams();
  const project = projects.find((p) => p.id === projectId);
  const referenceText = parseReferenceTexts(
    getParam(projDefReferenceTexts, project?.attributes?.defaultParams)
  )[roleIndex[role]];
  const plan = planPassage(passage, referenceText);
  const key =
    plan.status === 'fetch'
      ? [
          plan.referenceText.id,
          plan.book,
          plan.range.startChapter,
          plan.range.startVerse,
          plan.range.endChapter,
          plan.range.endVerse,
        ].join('/')
      : '';
  const [attempt, setAttempt] = useState(0);
  const fetchKey = key && `${key}#${attempt}`;
  const [result, setResult] = useState<FetchResult>();

  useEffect(() => {
    if (plan.status !== 'fetch') return;
    let cancelled = false;
    const load = async () => {
      try {
        const chapters = await getChapters(
          plan.referenceText.id,
          plan.book,
          chaptersInRange(plan.range)
        );
        if (!cancelled)
          setResult({
            key: fetchKey,
            text: passageText(chapters, plan.range),
          });
      } catch (err) {
        logError(Severity.error, errorReporter, err as Error);
        if (!cancelled) setResult({ key: fetchKey, error: 'fetchFailed' });
      }
    };
    void load(); // load reports its own errors
    return () => {
      cancelled = true;
    };
    // fetchKey names everything plan holds, plus the retry attempt; plan and
    // errorReporter are new objects each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  if (plan.status !== 'fetch') return plan;
  const fetched = plan.referenceText;
  if (result?.key !== fetchKey)
    return { status: 'loading', referenceText: fetched };
  if ('error' in result)
    return {
      status: 'error',
      referenceText: fetched,
      error: result.error,
      retry: () => setAttempt((a) => a + 1),
    };
  if (!result.text)
    return { status: 'error', referenceText: fetched, error: 'empty' };
  return { status: 'ready', referenceText: fetched, text: result.text };
};
