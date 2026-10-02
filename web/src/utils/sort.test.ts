import { normalizeReference } from './sort';

describe('normalizeReference', () => {
  describe('single verse references', () => {
    test('should normalize single verse with single digit chapter and verse', () => {
      expect(normalizeReference('Lk', '1:1')).toBe('Lk 001:001');
    });

    test('should normalize single verse with multi-digit chapter', () => {
      expect(normalizeReference('Mt', '10:1')).toBe('Mt 010:001');
    });

    test('should normalize single verse with multi-digit verse', () => {
      expect(normalizeReference('Lk', '1:11')).toBe('Lk 001:011');
    });

    test('should normalize single verse with large numbers', () => {
      expect(normalizeReference('Gen', '50:100')).toBe('Gen 050:100');
    });

    test('should normalize single verse with three-digit chapter', () => {
      expect(normalizeReference('Ps', '119:1')).toBe('Ps 119:001');
    });
  });

  describe('verse range references', () => {
    test('should normalize simple verse range', () => {
      expect(normalizeReference('Lk', '1:1-4')).toBe('Lk 001:001-004');
    });

    test('should normalize verse range with multi-digit numbers', () => {
      expect(normalizeReference('Lk', '1:8-10')).toBe('Lk 001:008-010');
    });

    test('should normalize verse range with larger numbers', () => {
      expect(normalizeReference('Lk', '1:11-17')).toBe('Lk 001:011-017');
    });

    test('should normalize verse range with large chapter', () => {
      expect(normalizeReference('Ps', '119:1-10')).toBe('Ps 119:001-010');
    });

    test('should normalize verse range crossing into double digits', () => {
      expect(normalizeReference('Mt', '5:9-12')).toBe('Mt 005:009-012');
    });
  });

  describe('cross-chapter references', () => {
    test('should normalize cross-chapter reference', () => {
      expect(normalizeReference('Lk', '1:14-2:20')).toBe('Lk 001:014-002:020');
    });

    test('should normalize cross-chapter reference with single digits', () => {
      expect(normalizeReference('Mt', '1:5-2:3')).toBe('Mt 001:005-002:003');
    });

    test('should normalize cross-chapter reference with multi-digit chapters', () => {
      expect(normalizeReference('Gen', '10:20-11:5')).toBe(
        'Gen 010:020-011:005'
      );
    });

    test('should normalize cross-chapter reference with large verses', () => {
      expect(normalizeReference('Lk', '1:80-2:10')).toBe('Lk 001:080-002:010');
    });
  });

  describe('zero-padding', () => {
    test('should pad single digit chapter to 3 digits', () => {
      expect(normalizeReference('Lk', '1:1')).toBe('Lk 001:001');
    });

    test('should pad double digit chapter to 3 digits', () => {
      expect(normalizeReference('Mt', '10:1')).toBe('Mt 010:001');
    });

    test('should not pad three digit chapter', () => {
      expect(normalizeReference('Ps', '119:1')).toBe('Ps 119:001');
    });

    test('should pad single digit verse to 3 digits', () => {
      expect(normalizeReference('Lk', '1:1')).toBe('Lk 001:001');
    });

    test('should pad double digit verse to 3 digits', () => {
      expect(normalizeReference('Lk', '1:11')).toBe('Lk 001:011');
    });

    test('should pad all numeric parts in verse range', () => {
      expect(normalizeReference('Lk', '1:8-10')).toBe('Lk 001:008-010');
    });

    test('should pad all numeric parts in cross-chapter reference', () => {
      expect(normalizeReference('Lk', '1:14-2:20')).toBe('Lk 001:014-002:020');
    });
  });

  describe('invalid and malformed references', () => {
    test('should return non-numeric reference as-is with book', () => {
      expect(normalizeReference('Lk', 'Note')).toBe('Lk Note');
    });

    test('should return non-numeric reference as-is without book', () => {
      expect(normalizeReference('', 'Note')).toBe('Note');
    });

    test('should handle empty reference string', () => {
      expect(normalizeReference('Lk', '')).toBe('Lk ');
    });

    test('should handle empty book with empty reference', () => {
      expect(normalizeReference('', '')).toBe('');
    });

    test('should handle reference with letters in verse', () => {
      expect(normalizeReference('Lk', '1:1a')).toBe('Lk 1:1a');
    });

    test('should handle reference with invalid format', () => {
      expect(normalizeReference('Lk', 'invalid')).toBe('Lk invalid');
    });

    test('should handle reference missing colon', () => {
      expect(normalizeReference('Lk', '1-4')).toBe('Lk 1-4');
    });

    test('should handle reference with only chapter', () => {
      expect(normalizeReference('Lk', '1')).toBe('Lk 1');
    });
  });

  describe('edge cases', () => {
    test('should handle empty book name', () => {
      expect(normalizeReference('', '1:1')).toBe(' 001:001');
    });

    test('should handle multi-character book abbreviation', () => {
      expect(normalizeReference('Gen', '1:1')).toBe('Gen 001:001');
    });

    test('should handle single character book', () => {
      expect(normalizeReference('J', '1:1')).toBe('J 001:001');
    });

    test('should handle very large chapter numbers', () => {
      expect(normalizeReference('Ps', '150:1')).toBe('Ps 150:001');
    });

    test('should handle very large verse numbers', () => {
      expect(normalizeReference('Ps', '119:176')).toBe('Ps 119:176');
    });

    test('should handle null reference', () => {
      expect(normalizeReference('Lk', null as any)).toBe('Lk null');
    });

    test('should handle undefined reference', () => {
      expect(normalizeReference('Lk', undefined as any)).toBe('Lk undefined');
    });

    test('should handle non-string reference', () => {
      expect(normalizeReference('Lk', 123 as any)).toBe('Lk 123');
    });
  });

  describe('sorting correctness', () => {
    test('should produce strings that sort correctly for single verses', () => {
      const ref1 = normalizeReference('Lk', '1:1');
      const ref2 = normalizeReference('Lk', '1:2');
      const ref3 = normalizeReference('Lk', '1:10');
      expect(ref1 < ref2).toBe(true);
      expect(ref2 < ref3).toBe(true);
    });

    test('should produce strings that sort correctly for verse ranges', () => {
      const ref1 = normalizeReference('Lk', '1:8-10');
      const ref2 = normalizeReference('Lk', '1:11-17');
      expect(ref1 < ref2).toBe(true);
    });

    test('should produce strings that sort correctly across chapters', () => {
      const ref1 = normalizeReference('Lk', '1:1');
      const ref2 = normalizeReference('Lk', '2:1');
      expect(ref1 < ref2).toBe(true);
    });

    test('should produce strings that sort correctly for different books', () => {
      const ref1 = normalizeReference('Gen', '1:1');
      const ref2 = normalizeReference('Lk', '1:1');
      expect(ref1 < ref2).toBe(true);
    });

    test('should produce strings that sort correctly for multi-digit chapters', () => {
      const ref1 = normalizeReference('Lk', '9:1');
      const ref2 = normalizeReference('Lk', '10:1');
      expect(ref1 < ref2).toBe(true);
    });

    test('should produce strings that sort correctly for multi-digit verses', () => {
      const ref1 = normalizeReference('Lk', '1:9');
      const ref2 = normalizeReference('Lk', '1:10');
      expect(ref1 < ref2).toBe(true);
    });
  });
});
