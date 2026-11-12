import React from 'react';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react';

// Unit backstop for CategoryListEdit's reconciliation of exclusive-edit state
// with a live-refreshed category list. The full UI path is covered by
// CategoryListEdit.cy.tsx; this spec pins the state machine only.

type TestCategory = {
  id: string;
  slug: string;
  category: string;
  org: string;
  titleMediaId: string;
  color: string;
  specialuse: string;
};

const mockCat = (id: string, category: string): TestCategory => ({
  id,
  slug: category,
  category,
  org: 'org-1',
  titleMediaId: '',
  color: '',
  specialuse: '',
});

// Mutable fixtures the tests swap to simulate an Orbit sync landing.
let mockCategories: TestCategory[] = [];
let mockOrbitCategories: { id: string }[] = [];
const mockEmpty: unknown[] = [];
const mockUpdateArtifactCategory = jest.fn();

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'offlineOnly') return [true, jest.fn()];
    if (key === 'memory') return [{ update: jest.fn(), keyMap: {} }, jest.fn()];
    return [undefined, jest.fn()];
  },
}));

jest.mock('../../crud', () => ({
  ArtifactCategoryType: {
    Discussion: 'discussion',
    Note: 'note',
    Resource: 'resource',
  },
  related: () => '',
  waitForRemoteId: jest.fn(async () => {}),
  useArtifactCategory: () => ({
    getArtifactCategorys: jest.fn(async () => mockCategories),
    localizedArtifactCategory: (c: string) => c,
    addNewArtifactCategory: jest.fn(),
    updateArtifactCategory: mockUpdateArtifactCategory,
  }),
}));

jest.mock('../../hoc/useOrbitData', () => ({
  // Stable references per model: a fresh array literal each call would rerun
  // every dependent effect on every render (see jest-testing-takeaways).
  useOrbitData: (model: string) =>
    model === 'artifactcategory' ? mockOrbitCategories : mockEmpty,
}));

jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../../crud/useBibleMedia', () => ({
  useBibleMedia: () => ({ getBibleMediaPlan: async () => ({ id: 'plan-1' }) }),
}));

jest.mock('../Sheet/NewArtifactCategory', () => ({
  NewArtifactCategory: () => <div data-testid="new-artifact-category" />,
}));

jest.mock('../../selector', () => ({
  categorySelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    apply: 'Apply',
    edit: 'Edit',
    editRemoved: 'The category you were editing was removed.',
    builtIn: 'System Categories',
    duplicate: 'Duplicate Category',
    ignoreInvalid: "Ignoring invalid category change '{0}'.",
    cancel: 'Cancel',
    save: 'Save',
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../../control', () => ({
  ActionRow: (props: { children?: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
  rowSx: {},
  Button: (props: {
    id?: string;
    disabled?: boolean;
    onClick?: () => void;
    children?: React.ReactNode;
  }) => (
    <button id={props.id} disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));

jest.mock('./CategoryEdit', () => {
  const RealReact = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: RealReact.forwardRef(
      (
        props: {
          category: TestCategory;
          disabled?: boolean;
          onChanged: (c: TestCategory) => void;
        },
        ref: React.Ref<unknown>
      ) => {
        RealReact.useImperativeHandle(ref, () => ({
          flushPendingGraphic: async () => {},
          discardPendingGraphic: () => {},
        }));
        return (
          <input
            id={`${props.category.id}adornment`}
            value={props.category.category}
            disabled={props.disabled}
            onChange={(e) =>
              props.onChanged({ ...props.category, category: e.target.value })
            }
          />
        );
      }
    ),
  };
});

import CategoryListEdit from './CategoryListEdit';
import { ArtifactCategoryType } from '../../crud';

const el = (id: string) => document.querySelector<HTMLElement>(`#${id}`);
const btn = (id: string) => {
  const found = el(id);
  if (!found) throw new Error(`#${id} not rendered`);
  return found as HTMLButtonElement;
};

describe('CategoryListEdit exclusive-edit state vs. live category refresh', () => {
  const renderList = () =>
    render(
      <CategoryListEdit
        type={ArtifactCategoryType.Discussion}
        teamId="team-1"
        onClose={jest.fn()}
      />
    );

  /** Simulate an Orbit live-query refresh delivering `next` (new array ref). */
  const syncCategories = async (
    rerender: (ui: React.ReactElement) => void,
    next: TestCategory[]
  ) => {
    await act(async () => {
      mockCategories = next;
      mockOrbitCategories = next.map((c) => ({ id: c.id }));
      rerender(
        <CategoryListEdit
          type={ArtifactCategoryType.Discussion}
          teamId="team-1"
          onClose={jest.fn()}
        />
      );
    });
  };

  beforeEach(() => {
    mockCategories = [
      mockCat('cat1', 'Category 1'),
      mockCat('cat2', 'Category 2'),
    ];
    mockOrbitCategories = [{ id: 'cat1' }, { id: 'cat2' }];
    mockUpdateArtifactCategory.mockClear();
  });

  it('releases the edit lock when a refresh removes the category being edited', async () => {
    const { rerender } = renderList();
    await act(async () => {});

    fireEvent.click(btn('cat-edit-cat1'));
    fireEvent.change(el('cat1adornment') as HTMLInputElement, {
      target: { value: 'Edited While Sync Deletes' },
    });

    await syncCategories(rerender, [mockCat('cat2', 'Category 2')]);

    // The edited row carried the only edit Cancel; it left with the category.
    expect(el('cat1adornment')).toBeNull();
    expect(el('cat-cancel-edit-cat1')).toBeNull();
    // Everything still on screen is gated on editingId, so a stale one traps
    // the user with no way to edit, delete, cancel or close.
    expect(btn('cat-edit-cat2').disabled).toBe(false);
    expect(btn('cat-delete-cat2').disabled).toBe(false);
    expect(btn('catCancel').disabled).toBe(false);

    // Discriminating: usable again, not merely enabled.
    fireEvent.click(btn('cat-edit-cat2'));
    expect((el('cat2adornment') as HTMLInputElement).disabled).toBe(false);
  });

  it('drops the staged rename of a category removed by a refresh', async () => {
    const { rerender } = renderList();
    await act(async () => {});

    fireEvent.click(btn('cat-edit-cat1'));
    fireEvent.change(el('cat1adornment') as HTMLInputElement, {
      target: { value: 'Applied Then Deleted' },
    });
    await act(async () => {
      fireEvent.click(btn('cat-apply-cat1'));
    });

    await syncCategories(rerender, [mockCat('cat2', 'Category 2')]);

    await act(async () => {
      fireEvent.click(btn('catSave'));
    });

    // Saving a rename onto a record sync already deleted resurrects it.
    const savedIds = mockUpdateArtifactCategory.mock.calls.map(
      (c) => (c[0] as TestCategory).id
    );
    expect(savedIds).not.toContain('cat1');
  });

  /**
   * Guard against an over-broad fix: clearing editingId on every refresh would
   * also discard edits whose own category is untouched by the sync.
   */
  it('keeps the in-progress edit when a refresh removes a different category', async () => {
    const { rerender } = renderList();
    await act(async () => {});

    fireEvent.click(btn('cat-edit-cat1'));
    fireEvent.change(el('cat1adornment') as HTMLInputElement, {
      target: { value: 'Survives Unrelated Delete' },
    });

    await syncCategories(rerender, [mockCat('cat1', 'Category 1')]);

    expect(el('cat2adornment')).toBeNull();
    expect((el('cat1adornment') as HTMLInputElement).value).toBe(
      'Survives Unrelated Delete'
    );
    expect(btn('cat-apply-cat1').disabled).toBe(false);
  });
});
