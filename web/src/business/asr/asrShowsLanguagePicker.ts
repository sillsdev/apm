import { isLangSet } from '../../utils/langTag';

/**
 * Whether AsrSettings shows the language control: sister required, or no
 * primary (vernacular/step) language to use.
 */
export function asrShowsLanguagePicker(
  primaryBcp47: string | undefined,
  needsSister: boolean | undefined
): boolean {
  return needsSister === true || !isLangSet(primaryBcp47);
}
