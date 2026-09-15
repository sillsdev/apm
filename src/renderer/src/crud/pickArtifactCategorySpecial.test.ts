import { describe, it, expect } from '@jest/globals';
import type { ArtifactCategoryD } from '../model';
import {
  canonicalNoteSpecial,
  pickSpecialWinner,
} from './pickArtifactCategorySpecial';

const ORG = 'org-1';

const cat = (
  id: string,
  opts: {
    remoteId?: string;
    specialuse?: string;
    color?: string;
    orgId?: string | null;
    titleMediaId?: string;
    categoryname?: string;
  } = {}
): ArtifactCategoryD =>
  ({
    id,
    type: 'artifactcategory',
    keys: opts.remoteId !== undefined ? { remoteId: opts.remoteId } : {},
    attributes: {
      categoryname: opts.categoryname ?? id,
      specialuse: opts.specialuse ?? 'chapter',
      color: opts.color ?? '',
      note: true,
    },
    relationships: {
      organization:
        opts.orgId === null
          ? { data: null }
          : { data: { type: 'organization', id: opts.orgId ?? ORG } },
      titleMediafile: opts.titleMediaId
        ? { data: { type: 'mediafile', id: opts.titleMediaId } }
        : { data: null },
    },
  }) as unknown as ArtifactCategoryD;

describe('pickSpecialWinner', () => {
  it('prefers remoteId over unsynced when both share specialuse', () => {
    const winner = pickSpecialWinner([
      cat('chapter-old', { specialuse: 'chapter' }),
      cat('chapter-new', { remoteId: '99', specialuse: 'chapter' }),
    ]);
    expect(winner.id).toBe('chapter-new');
  });

  it('prefers categoryname matching specialuse when both are synced', () => {
    // Devin: localized "Chapter Number" must not beat the slug key for i18n.
    const winner = pickSpecialWinner([
      cat('chapter-localized', {
        remoteId: '21',
        specialuse: 'chapter',
        categoryname: 'Chapter Number',
      }),
      cat('chapter-slug', {
        remoteId: '22',
        specialuse: 'chapter',
        categoryname: 'chapter',
      }),
    ]);
    expect(winner.id).toBe('chapter-slug');
  });
});

describe('canonicalNoteSpecial', () => {
  it('returns synced winner even when the loser appears first in the list', () => {
    // Devin / CHNUM: raw .find() would pick chapter-old first.
    const picked = canonicalNoteSpecial(
      [
        cat('chapter-old', {
          remoteId: '98',
          specialuse: 'chapter',
          color: '#ff0000',
        }),
        cat('chapter-new', {
          remoteId: '99',
          specialuse: 'chapter',
          color: '#00ff00',
        }),
      ],
      'chapter',
      ORG
    );
    expect(picked?.id).toBe('chapter-new');
  });

  it('prefers the team chapter over a system chapter', () => {
    const picked = canonicalNoteSpecial(
      [
        cat('chapter-system', {
          remoteId: '1',
          specialuse: 'chapter',
          orgId: null,
        }),
        cat('chapter-team', {
          remoteId: '99',
          specialuse: 'chapter',
        }),
      ],
      'chapter',
      ORG
    );
    expect(picked?.id).toBe('chapter-team');
  });
});
