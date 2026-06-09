import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { passageRefText } from '../../../crud/passage';
import { sectionDescription } from '../../../crud/section';
import { BookName, Passage, Section, SharedResourceD } from '../../../model';
import { PassageTypeEnum } from '../../../model/passageType';

/** Plain-text label matching PassageDetailChooser display rules. */
export function passageLabelText(
  passage: Passage,
  allBookData: BookName[],
  sharedResource?: SharedResourceD,
  section?: Section
): string {
  const psgType = passageTypeFromRef(passage?.attributes?.reference, false);

  if (psgType === PassageTypeEnum.PASSAGE) {
    let ref = passageRefText(passage, allBookData).trim();
    if (ref.length === 0 && section) {
      ref = `${section.attributes?.sequencenum ?? ''}.${
        passage.attributes?.sequencenum || 1
      }`.replace(/^\./, '');
    }
    return ref;
  }

  if (sharedResource?.attributes?.title) {
    return sharedResource.attributes.title;
  }
  const ref = passage?.attributes?.reference ?? '';
  if (!ref) return '';
  return String(ref).substring(psgType.length + 1);
}

export function passageHeaderLabel(
  passage: Passage,
  options: {
    allBookData: BookName[];
    section?: Section;
    flat: boolean;
    sharedResource?: SharedResourceD;
    sectionMap?: Map<number, string>;
    withSectionDescription?: boolean;
  }
): string {
  const {
    allBookData,
    section,
    flat,
    sharedResource,
    sectionMap,
    withSectionDescription,
  } = options;
  const label = passageLabelText(passage, allBookData, sharedResource, section);
  if (withSectionDescription && section && !flat) {
    const desc = sectionDescription(section, sectionMap, passage);
    const delim = label ? '\u00A0-\u00A0' : '';
    return desc + delim + label;
  }
  return label;
}
