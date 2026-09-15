/**
 * Devin: retained synced chapter losers stay in Orbit; CHNUM must not .find()
 * the first specialuse=chapter (loser color + missing re-keyed graphic).
 */
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { ArtifactCategoryD, GraphicD } from '../model';

const ORG = 'org-1';

let orbitCats: ArtifactCategoryD[] = [];
let orbitGraphics: GraphicD[] = [];

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn((model: string) => {
    if (model === 'graphic') return orbitGraphics;
    if (model === 'artifactcategory') return orbitCats;
    return [];
  }),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'organization') return [ORG, jest.fn()];
    return [undefined, jest.fn()];
  }),
}));

jest.mock('./useArtifactCategory', () => ({
  useArtifactCategory: () => ({
    fromLocalizedArtifactCategory: (s: string) => s,
  }),
}));

jest.mock('../utils/useCompression', () => ({
  ApmDim: 40,
  Rights: 'rights',
}));

import { useGraphicFind } from './useGraphicFind';

const noteCat = (
  id: string,
  opts: { remoteId: string; color: string }
): ArtifactCategoryD =>
  ({
    id,
    type: 'artifactcategory',
    keys: { remoteId: opts.remoteId },
    attributes: {
      categoryname: id,
      specialuse: 'chapter',
      color: opts.color,
      note: true,
    },
    relationships: {
      organization: { data: { type: 'organization', id: ORG } },
      titleMediafile: { data: null },
    },
  }) as unknown as ArtifactCategoryD;

const categoryGraphic = (resourceId: number, uri: string): GraphicD =>
  ({
    id: `g-${resourceId}`,
    type: 'graphic',
    keys: { remoteId: `g-${resourceId}` },
    attributes: {
      resourceType: 'category',
      resourceId,
      info: JSON.stringify({
        '40': {
          name: 'x-40.png',
          content: uri,
          type: 'image/png',
          dimension: 40,
        },
        rights: 'SIL',
      }),
    },
  }) as unknown as GraphicD;

describe('useGraphicFind (CHNUM chapter special)', () => {
  beforeEach(() => {
    orbitCats = [];
    orbitGraphics = [];
  });

  it('uses the canonical winner color and graphic when a synced loser is first', () => {
    // Loser first (as Orbit often orders); graphic already re-keyed to winner 99.
    orbitCats = [
      noteCat('chapter-old', { remoteId: '98', color: '#ff0000' }),
      noteCat('chapter-new', { remoteId: '99', color: '#00ff00' }),
    ];
    orbitGraphics = [categoryGraphic(99, 'data:image/png;base64,winner')];

    const { result } = renderHook(() => useGraphicFind());
    const found = result.current(
      { type: 'section', id: 'sec-1', keys: { remoteId: '1' } } as never,
      'CHNUM 1'
    );

    expect(found.color).toBe('#00ff00');
    expect(found.uri).toBe('data:image/png;base64,winner');
  });
});
