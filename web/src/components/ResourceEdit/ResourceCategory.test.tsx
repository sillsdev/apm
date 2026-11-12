import { render } from '@testing-library/react';

const mockSelect = jest.fn((_props: { type: string }) => (
  <div data-testid="select-cat" />
));

jest.mock('../../crud', () => ({
  ArtifactCategoryType: { Resource: 'resource', Note: 'note' },
}));

jest.mock('../../crud/useArtifactCategory', () => ({
  ArtifactCategoryType: { Resource: 'resource', Note: 'note' },
}));

jest.mock('../Sheet/SelectArtifactCategory', () => ({
  __esModule: true,
  default: (props: { type: string }) => mockSelect(props),
}));

import { ArtifactCategoryType } from '../../crud/useArtifactCategory';
import { ResourceCategory } from './ResourceCategory';
import type { IResourceDialog } from './ResourceOverview';

const baseState = { note: false, category: '' } as unknown as IResourceDialog;

test('uses note categories when note is true', () => {
  render(
    <ResourceCategory
      state={{ ...baseState, note: true }}
      setState={jest.fn()}
    />
  );
  expect(mockSelect).toHaveBeenCalledWith(
    expect.objectContaining({ type: ArtifactCategoryType.Note })
  );
});

test('uses resource categories when note is false', () => {
  mockSelect.mockClear();
  render(
    <ResourceCategory
      state={{ ...baseState, note: false }}
      setState={jest.fn()}
    />
  );
  expect(mockSelect).toHaveBeenCalledWith(
    expect.objectContaining({ type: ArtifactCategoryType.Resource })
  );
});
