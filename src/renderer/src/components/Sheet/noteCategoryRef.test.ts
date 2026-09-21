import { expect, test } from '@jest/globals';
import { noteCategoryOf, noteCategoryRef } from './noteCategoryRef';

test('fills in the category when the stored reference is a bare NOTE', () => {
  expect(noteCategoryRef('NOTE', 'Devotional')).toBe('NOTE|Devotional');
});

test('replaces a stale category with the one from the shared resource', () => {
  expect(noteCategoryRef('NOTE|Hymn', 'Devotional')).toBe('NOTE|Devotional');
});

test('keeps the stored reference when no category is known', () => {
  expect(noteCategoryRef('NOTE|Devotional', undefined)).toBe('NOTE|Devotional');
  expect(noteCategoryRef('NOTE', undefined)).toBe('NOTE');
});

test('leaves references that are not notes alone', () => {
  expect(noteCategoryRef('1:1-4', 'Devotional')).toBe('1:1-4');
  expect(noteCategoryRef('CHNUM|1', 'Devotional')).toBe('CHNUM|1');
  expect(noteCategoryRef(undefined, 'Devotional')).toBeUndefined();
});

test('noteCategoryOf tells a bare note from one carrying a category', () => {
  //only a bare NOTE is the corruption the repair writes back
  expect(noteCategoryOf('NOTE')).toBe('');
  expect(noteCategoryOf('NOTE|')).toBe('');
  expect(noteCategoryOf('NOTE|Devotional')).toBe('Devotional');
});

test('noteCategoryOf ignores references that are not notes', () => {
  expect(noteCategoryOf('CHNUM|1')).toBe('');
  expect(noteCategoryOf('1:1-4')).toBe('');
  expect(noteCategoryOf(undefined)).toBe('');
});
