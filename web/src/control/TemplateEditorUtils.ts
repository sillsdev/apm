import { ITemplateStrings } from '../model';
import { addPt } from '../utils/addPt';

export enum TemplateCode {
  BOOK = 'BOOK',
  BOOKNAME = 'BOOKNAME',
  SECT = 'SECT',
  PASS = 'PASS',
  CHAP = 'CHAP',
  BEG = 'BEG',
  END = 'END',
  REF = 'REF',
  TITLE = 'TITLE',
}

export const validTemplateCodes = Object.values(TemplateCode);

// Common template strings
export const BOOK_CHAPTER_PASSAGE_TEMPLATE = `{${TemplateCode.BOOK}}{${TemplateCode.CHAP}}_{${TemplateCode.BEG}}-{${TemplateCode.END}}`;
export const SECTION_PASSAGE_TEMPLATE = `{${TemplateCode.SECT}}_{${TemplateCode.PASS}}`;
export const REFERENCE_TEMPLATE = `{${TemplateCode.REF}}`;
export const NOTE_TITLE_TEMPLATE = `{${TemplateCode.BOOK}}NOTE_{${TemplateCode.TITLE}}`;
export const SECT_TEMPLATE = `{${TemplateCode.SECT}}`;

/**
 * Gets the label for a template code
 * @param code The template code (e.g., 'BOOK', 'CHAP')
 * @param t Template strings from localization
 * @param organizedBy The organized by term (e.g., 'Section', 'Chapter')
 * @returns The label string for the code
 */
export const getTemplateCodeLabel = (
  code: string,
  t: ITemplateStrings,
  organizedBy: string
): string => {
  switch (code) {
    case TemplateCode.BOOK:
      return addPt(t.book);
    case TemplateCode.BOOKNAME:
      return t.bookname;
    case TemplateCode.SECT:
      return organizedBy;
    case TemplateCode.PASS:
      return t.passage.replace('{0}', organizedBy);
    case TemplateCode.CHAP:
      return t.chapter;
    case TemplateCode.BEG:
      return t.beginning;
    case TemplateCode.END:
      return t.end;
    case TemplateCode.REF:
      return t.reference;
    case TemplateCode.TITLE:
      return t.title;
    default:
      return '';
  }
};

/**
 * Gets all template code labels for a given set of valid codes
 * @param validCodes Array of valid template code strings
 * @param t Template strings from localization
 * @param organizedBy The organized by term (e.g., 'Section', 'Chapter')
 * @returns Record mapping code to label
 */
export const getTemplateCodeLabels = (
  validCodes: string[],
  t: ITemplateStrings,
  organizedBy: string
): Record<string, string> => {
  const labels: Record<string, string> = {};
  validCodes.forEach((code) => {
    const label = getTemplateCodeLabel(code, t, organizedBy);
    if (label) {
      labels[code] = label;
    }
  });
  return labels;
};

/**
 * Validates a template string against a list of valid codes
 * @param template The template string to validate
 * @param validCodes Array of valid template code strings (e.g., ['BOOK', 'CHAP'])
 * @returns true if the template contains invalid codes or incomplete braces
 */
export const hasInvalidTemplate = (
  template: string,
  validCodes: string[]
): boolean => {
  // Check for multiple consecutive opening braces {{ or more
  if (/\{\{/.test(template)) {
    return true;
  }

  // Check for multiple consecutive closing braces }} or more
  if (/\}\}/.test(template)) {
    return true;
  }

  // Match complete template codes: {CODE} or {}
  const completeRegex = /\{([A-Za-z]*)\}/g;
  let match;

  // Check for invalid complete codes (including empty {})
  while ((match = completeRegex.exec(template)) !== null) {
    const code = match[1].toUpperCase();
    // Empty braces {} or invalid codes are invalid
    if (code.length === 0 || !validCodes.includes(code)) {
      return true;
    }
  }

  // Check for incomplete template codes (starting with { but not closed)
  const lastOpenBrace = template.lastIndexOf('{');
  const lastCloseBrace = template.lastIndexOf('}');
  if (lastOpenBrace > lastCloseBrace) {
    // There's an unclosed brace
    return true;
  }

  return false;
};
