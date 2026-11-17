import { pickTodoMediaRow } from './pickTodoMediaRow';

describe('pickTodoMediaRow', () => {
  const rows = [
    { mediafile: { id: 'm1' }, role: 'view' },
    { mediafile: { id: 'm1' }, role: 'editor' },
    { mediafile: { id: 'm1' }, role: 'transcriber' },
    { mediafile: { id: 'm2' }, role: 'editor' },
  ];

  it('returns undefined when mediaId is missing', () => {
    expect(pickTodoMediaRow(rows, undefined)).toBeUndefined();
    expect(pickTodoMediaRow(rows, null)).toBeUndefined();
    expect(pickTodoMediaRow(rows, '')).toBeUndefined();
  });

  it('prefers transcriber over editor and view', () => {
    expect(pickTodoMediaRow(rows, 'm1')?.role).toBe('transcriber');
  });

  it('prefers editor when no transcriber row', () => {
    expect(pickTodoMediaRow(rows, 'm2')?.role).toBe('editor');
  });

  it('falls back to any matching media id', () => {
    const onlyView = [{ mediafile: { id: 'm3' }, role: 'view' }];
    expect(pickTodoMediaRow(onlyView, 'm3')?.role).toBe('view');
  });
});
