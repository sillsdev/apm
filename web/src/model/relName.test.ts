import Memory from '@orbit/memory';
import { findRecords } from '../crud/tryFindRecord';
import { recordRef, type RelName } from './baseModel';
import type { RelKey } from '../crud/related';
import type { MediaFileD } from './mediafile';
import type { PassageD } from './passage';
import type { SectionD } from './section';

type Expect<T extends true> = T;
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _passageIdentity = Expect<
  Exact<RelName<{ type: 'passage'; id: string }>, RelKey<PassageD>>
>;
type _mediaIdentity = Expect<
  Exact<RelName<{ type: 'mediafile'; id: string }>, RelKey<MediaFileD>>
>;
type _wideIdentity = Expect<
  Exact<RelName<{ type: string; id: string }>, string>
>;

test('recordRef keeps the table name', () => {
  expect(recordRef('passage', 'p1')).toEqual({ type: 'passage', id: 'p1' });
});

test('findRecords follows the table', () => {
  const typed = (memory: Memory) => {
    const sections: SectionD[] = findRecords(memory, 'section');
    return sections.length;
  };
  expect(typed).toEqual(expect.any(Function));
});

type _sectionIsNotPassage = Expect<
  [SectionD[]] extends [PassageD[]] ? false : true
>;
