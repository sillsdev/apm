import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import EditReferenceDropdown, {
  type EditReferenceValue,
} from './EditReferenceDropdown';
import {
  type PassageVerseOption,
  toPassageVerseKey,
} from '../../../../utils/markVersesPassageVerses';

jest.mock('../../../../utils/useMobile', () => ({
  useMobile: () => ({
    isMobile: false,
    isMobileView: false,
    isMobileWidth: false,
  }),
}));

const option = (chapter: number, verse: number): PassageVerseOption => ({
  chapter,
  verse,
  key: toPassageVerseKey(chapter, verse),
});

/** Every verse in a chapter range, e.g. verses(1, 3, 5) -> 1:3,1:4,1:5. */
const verses = (chapter: number, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => option(chapter, from + i));

// A passage that crosses a chapter boundary: LUK 1:78 - 2:5.
const multiChapterOptions: PassageVerseOption[] = [
  ...verses(1, 78, 80),
  ...verses(2, 1, 5),
];

// A single-chapter passage: 1:1 - 1:4.
const singleChapterOptions: PassageVerseOption[] = verses(1, 1, 4);

const baseValue: EditReferenceValue = {
  splitVerse: false,
  canSplit: true,
  startChapter: 1,
  startVerse: 78,
  startSuffix: '',
  endChapter: 2,
  endVerse: 5,
  endSuffix: '',
};

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof EditReferenceDropdown>> = {}
) => {
  const onSave = jest.fn();
  const onCancel = jest.fn();
  render(
    <EditReferenceDropdown
      open
      limits="0.0-1.0"
      endVerseOptions={multiChapterOptions}
      title="Edit Reference for"
      cancelLabel="Cancel"
      saveLabel="Save"
      splitVerseLabel="Split Verse"
      value={baseValue}
      unrestricted
      onCancel={onCancel}
      onSave={onSave}
      {...overrides}
    />
  );
  return { onSave, onCancel };
};

const dialog = () => screen.getByRole('dialog');

/** Open a MUI Select and return its menu option data-values. */
const optionValues = async (user: UserEvent, label: string) => {
  await user.click(within(dialog()).getByLabelText(label));
  const listbox = await screen.findByRole('listbox');
  const values = within(listbox)
    .getAllByRole('option')
    .map((el) => el.getAttribute('data-value') ?? '');
  await user.keyboard('{Escape}');
  await waitFor(() => {
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  return values;
};

/** Choose a MUI Select option by its data-value. */
const selectByLabel = async (
  user: UserEvent,
  label: string,
  value: string
) => {
  await user.click(within(dialog()).getByLabelText(label));
  const listbox = await screen.findByRole('listbox');
  const match = within(listbox)
    .getAllByRole('option')
    .find(
      (el) =>
        el.getAttribute('data-value') === value || el.textContent === value
    );
  if (!match) {
    throw new Error(`No option matching "${value}" for "${label}"`);
  }
  await user.click(match);
  await waitFor(() => {
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
};

describe('EditReferenceDropdown unrestricted with multiple chapters', () => {
  test('renders discrete chapter and verse dropdowns for both endpoints', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(await optionValues(user, 'start chapter number')).toEqual([
      '1',
      '2',
    ]);
    expect(await optionValues(user, 'end chapter number')).toEqual(['1', '2']);
    expect(
      within(dialog()).getByLabelText('start chapter number')
    ).toHaveTextContent('1');
    expect(
      within(dialog()).getByLabelText('end chapter number')
    ).toHaveTextContent('2');
  });

  test('verse options are scoped to the selected chapter', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Start chapter 1 -> verses 78,79,80.
    expect(await optionValues(user, 'start verse number')).toEqual([
      '78',
      '79',
      '80',
    ]);
    // End chapter 2 -> verses 1..5.
    expect(await optionValues(user, 'end verse number')).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
  });

  test('changing the start chapter re-scopes and clamps the start verse', async () => {
    const user = userEvent.setup();
    renderDialog();

    await selectByLabel(user, 'start chapter number', '2');

    expect(await optionValues(user, 'start verse number')).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    // 78 is not a verse of chapter 2, so the verse clamps to the chapter's first.
    expect(
      within(dialog()).getByLabelText('start verse number')
    ).toHaveTextContent('1');
  });

  test('saves the edited chapter:verse - chapter:verse reference', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await selectByLabel(user, 'start verse number', '79');
    await selectByLabel(user, 'end verse number', '3');
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        startChapter: 1,
        startVerse: 79,
        endChapter: 2,
        endVerse: 3,
      })
    );
  });
});

describe('EditReferenceDropdown unrestricted with a single chapter', () => {
  test('shows the chapter as fixed text, verses as dropdowns', async () => {
    const user = userEvent.setup();
    renderDialog({
      endVerseOptions: singleChapterOptions,
      value: {
        ...baseValue,
        startChapter: 1,
        startVerse: 2,
        endChapter: 1,
        endVerse: 3,
      },
    });

    expect(
      within(dialog()).queryByLabelText('start chapter number')
    ).not.toBeInTheDocument();
    expect(
      within(dialog()).queryByLabelText('end chapter number')
    ).not.toBeInTheDocument();
    expect(await optionValues(user, 'start verse number')).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(await optionValues(user, 'end verse number')).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });
});

describe('EditReferenceDropdown with a fixed start (unrestricted off)', () => {
  test('keeps the start as a label and only the end verse editable', () => {
    renderDialog({
      unrestricted: false,
      endVerseOptions: verses(1, 3, 4),
      value: {
        ...baseValue,
        startChapter: 1,
        startVerse: 3,
        endChapter: 1,
        endVerse: 4,
      },
    });

    expect(
      within(dialog()).queryByLabelText('start verse number')
    ).not.toBeInTheDocument();
    expect(
      within(dialog()).getByLabelText('start verse reference')
    ).toHaveTextContent('1:3');
    expect(
      within(dialog()).getByLabelText('end verse number')
    ).toBeInTheDocument();
  });
});
