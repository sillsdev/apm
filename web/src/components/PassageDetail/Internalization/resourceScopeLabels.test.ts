import {
  getSectionResourceType,
  sectionResourceDesc,
  passageResourceDesc,
} from './resourceScopeLabels';
import { IPassageDetailArtifactsStrings, SheetLevel } from '../../../model';
import { PassageTypeEnum } from '../../../model/passageTypeEnum';

const t = {
  bookResource: 'Book Resource',
  movementResource: 'Movement Resource',
  noteResource: 'Note Resource',
  passageResource: 'Passage Resource',
} as unknown as IPassageDetailArtifactsStrings;

describe('resource labels (shared by edit dialog + add wizard)', () => {
  it('maps a section level to its scope type', () => {
    expect(
      getSectionResourceType({ attributes: { level: SheetLevel.Book } })
    ).toBe(PassageTypeEnum.BOOK);
    expect(
      getSectionResourceType({ attributes: { level: SheetLevel.Movement } })
    ).toBe(PassageTypeEnum.MOVEMENT);
    expect(
      getSectionResourceType({ attributes: { level: SheetLevel.Section } })
    ).toBeUndefined();
    expect(getSectionResourceType(undefined)).toBeUndefined();
  });

  it('labels a section by type, falling back to organizedBy', () => {
    expect(
      sectionResourceDesc(
        { attributes: { level: SheetLevel.Book } },
        t,
        'Sections'
      )
    ).toBe('Book Resource');
    expect(
      sectionResourceDesc(
        { attributes: { level: SheetLevel.Movement } },
        t,
        'Sections'
      )
    ).toBe('Movement Resource');
    expect(
      sectionResourceDesc(
        { attributes: { level: SheetLevel.Section } },
        t,
        'Sections'
      )
    ).toBe('Sections');
  });

  it('labels a passage, distinguishing NOTE references', () => {
    expect(
      passageResourceDesc({ attributes: { reference: 'GEN 1:1' } }, t)
    ).toBe('Passage Resource');
    expect(passageResourceDesc({ attributes: { reference: 'NOTE' } }, t)).toBe(
      'Note Resource'
    );
    expect(passageResourceDesc(undefined, t)).toBe('Passage Resource');
  });
});
