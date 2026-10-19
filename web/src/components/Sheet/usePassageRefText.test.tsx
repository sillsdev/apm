import { renderHook } from '@testing-library/react';
import React from 'react';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: jest.fn(),
}));

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('../../selector', () => ({
  planSheetSelector: jest.fn(),
}));

jest.mock('../../context/PlanContext', () => ({
  PlanContext: {},
}));

import { usePassageRefText } from './usePassageRefText';
import { PassageTypeEnum } from '../../model';
import { planSheetSelector } from '../../selector';
import { useSelector } from 'react-redux';

const { useContext } = React;

const defaultBookMap: Record<string, string> = {
  GEN: 'Genesis',
  MAT: 'Matthew',
};

const setup = ({
  scripture = true,
  bookMap,
}: {
  scripture?: boolean;
  bookMap?: Record<string, string> | null;
} = {}) => {
  (useContext as jest.Mock).mockReturnValue({ state: { scripture } });
  (useSelector as unknown as jest.Mock).mockImplementation((selector) =>
    selector === planSheetSelector
      ? { unknownBook: 'Unknown Book' }
      : selector({
          books: {
            map: bookMap === null ? undefined : (bookMap ?? defaultBookMap),
          },
        })
  );
  return renderHook(() => usePassageRefText()).result.current;
};

describe('usePassageRefText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PASSAGE type', () => {
    it('prefixes the full book name in scripture projects', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.PASSAGE,
          book: 'GEN',
          passageRef: '1:1-5',
          comment: 'Test comment',
        })
      ).toBe('Genesis 1:1-5');
    });

    it('omits the book name in non-scripture projects', () => {
      const getRefText = setup({ scripture: false });
      expect(
        getRefText({
          psgType: PassageTypeEnum.PASSAGE,
          book: 'GEN',
          passageRef: '1:1-5',
        })
      ).toBe(' 1:1-5');
    });

    it('returns undefined for a book not in the book map', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.PASSAGE,
          book: 'UNK',
          passageRef: '1:1',
        })
      ).toBe('undefined 1:1');
    });

    it('uses the book abbreviation when the book map is undefined', () => {
      const getRefText = setup({ bookMap: null });
      expect(
        getRefText({
          psgType: PassageTypeEnum.PASSAGE,
          book: 'GEN',
          passageRef: '1:1',
        })
      ).toBe('GEN 1:1');
    });

    it('uses "Unknown Book" when no book is given', () => {
      const getRefText = setup();
      expect(
        getRefText({ psgType: PassageTypeEnum.PASSAGE, passageRef: '1:1' })
      ).toBe('Unknown Book 1:1');
    });

    it('keeps the book name when the reference is empty', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.PASSAGE,
          book: 'GEN',
          passageRef: '',
        })
      ).toBe('Genesis ');
    });

    it('keeps special characters in the reference', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.PASSAGE,
          book: 'GEN',
          passageRef: '1:1-5 "Special quote" & symbols',
        })
      ).toBe('Genesis 1:1-5 "Special quote" & symbols');
    });
  });

  describe('other passage types', () => {
    it('returns an empty string when there is no reference', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.NOTE,
          book: 'GEN',
          comment: 'Test comment',
        })
      ).toBe('');
    });

    it('strips the type prefix from the reference', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.CHAPTERNUMBER,
          passageRef: `${PassageTypeEnum.CHAPTERNUMBER} 1`,
        })
      ).toBe('1');
    });

    it('returns a reference without a type prefix as-is', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.CHAPTERNUMBER,
          passageRef: '123',
        })
      ).toBe('123');
    });

    it('returns only the comment for CHAPTERNUMBER when there is one', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.CHAPTERNUMBER,
          passageRef: '1',
          comment: 'Comment with "quotes" & symbols',
        })
      ).toBe('Comment with "quotes" & symbols');
    });

    it('returns the reference for CHAPTERNUMBER with an empty comment', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.CHAPTERNUMBER,
          passageRef: '1',
          comment: '',
        })
      ).toBe('1');
    });

    it('ignores the comment for non-CHAPTERNUMBER types', () => {
      const getRefText = setup();
      expect(
        getRefText({
          psgType: PassageTypeEnum.NOTE,
          passageRef: 'Note reference',
          comment: 'Note comment',
        })
      ).toBe('Note reference');
    });

    it.each([
      PassageTypeEnum.NOTE,
      PassageTypeEnum.CHAPTERNUMBER,
      PassageTypeEnum.BOOK,
      PassageTypeEnum.ALTBOOK,
      PassageTypeEnum.MOVEMENT,
    ])('does not add the book name for %s', (psgType) => {
      const getRefText = setup();
      expect(
        getRefText({ psgType, book: 'GEN', passageRef: 'Test reference' })
      ).toBe('Test reference');
    });
  });
});
