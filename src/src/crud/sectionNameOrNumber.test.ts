import { Section } from '../model';
import { sectionNameOrNumber } from './section';

const mkSection = (sequencenum: number, name?: string) =>
  ({ attributes: { sequencenum, name } }) as unknown as Section;

describe('sectionNameOrNumber', () => {
  const sectionMap = new Map<number, string>([
    [1, 'M3'],
    [1.01, 'M3 S1'],
  ]);

  it('returns only the name when one is given', () => {
    expect(sectionNameOrNumber(mkSection(1.01, 'Section 1'), sectionMap)).toBe(
      'Section 1'
    );
  });

  it('returns only the ident when there is no name', () => {
    expect(sectionNameOrNumber(mkSection(1.01), sectionMap)).toBe('M3 S1');
    expect(sectionNameOrNumber(mkSection(1, '  '), sectionMap)).toBe('M3');
  });

  it('falls back to the sequence number without a section map', () => {
    expect(sectionNameOrNumber(mkSection(2))).toBe('2');
  });
});
