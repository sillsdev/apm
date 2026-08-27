import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import EditReferenceDropdown, {
  type EditReferenceValue,
} from './EditReferenceDropdown';
import {
  type PassageVerseOption,
  toPassageVerseKey,
} from '../../../../utils/markVersesPassageVerses';

/** Stub the wheel as a native select so the picker tests stay deterministic. */
jest.mock('@ncdai/react-wheel-picker', () => ({
  WheelPickerWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wheel-wrapper">{children}</div>
  ),
  WheelPicker: ({
    options,
    value,
    onValueChange,
  }: {
    options: { value: string; label: React.ReactNode }[];
    value: string;
    onValueChange: (next: string) => void;
  }) => (
    <>
      {/*
       * Stand in for the library's internal focusable div: the real one carries
       * `data-rwp`, owns the Arrow-key handling, and is what the component
       * focuses on click (TT-7622).
       */}
      <div data-rwp tabIndex={0} data-testid="wheel-rwp" />
      <select
        data-testid="wheel-select"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option
            key={option.value === '' ? 'empty' : option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </>
  ),
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

/** The wheel column wrapper (the element the component binds onClick to). */
const wheelGroup = (label: string) =>
  within(dialog()).getByRole('group', { name: label });

/** The stub select backing the wheel with this aria-label. */
const wheel = (label: string) =>
  within(wheelGroup(label)).getByTestId('wheel-select');

/** The option values offered by a wheel, in order. */
const optionValues = (label: string) =>
  [...wheel(label).querySelectorAll('option')].map((el) => el.value);

/** Spin a wheel to one of its option values. */
const selectWheelByLabel = async (
  user: UserEvent,
  label: string,
  value: string
) => {
  await user.selectOptions(wheel(label), value);
};

describe('EditReferenceDropdown unrestricted with multiple chapters', () => {
  test('renders discrete chapter and verse wheels for both endpoints', () => {
    renderDialog();

    expect(optionValues('start chapter number')).toEqual(['1', '2']);
    expect(optionValues('end chapter number')).toEqual(['1', '2']);
    expect(wheel('start chapter number')).toHaveValue('1');
    expect(wheel('end chapter number')).toHaveValue('2');
  });

  test('verse options are scoped to the selected chapter', () => {
    renderDialog();

    // Start chapter 1 -> verses 78,79,80.
    expect(optionValues('start verse number')).toEqual(['78', '79', '80']);
    // End chapter 2 -> verses 1..5.
    expect(optionValues('end verse number')).toEqual(['1', '2', '3', '4', '5']);
  });

  test('changing the start chapter re-scopes and clamps the start verse', async () => {
    const user = userEvent.setup();
    renderDialog();

    await selectWheelByLabel(user, 'start chapter number', '2');

    expect(optionValues('start verse number')).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    // 78 is not a verse of chapter 2, so the verse clamps to the chapter's first.
    expect(wheel('start verse number')).toHaveValue('1');
  });

  test('never offers a verse outside the passage', () => {
    // 77 precedes the passage (1:78 - 2:5). Callers snap such a reference onto a
    // real passage verse before opening; the wheel must not offer it either way,
    // so a bad reference can only be corrected, never re-picked.
    renderDialog({
      value: { ...baseValue, startChapter: 1, startVerse: 77 },
    });

    expect(optionValues('start verse number')).toEqual(['78', '79', '80']);
  });

  test('clicking a wheel focuses the element that handles the arrow keys', async () => {
    // TT-7622: the library preventDefaults mousedown, so a click never moves
    // focus to its internal `[data-rwp]` div and the library's own Arrow-key
    // handler never fires. The component focuses that div on click; without
    // that, the arrows do nothing after a click.
    const user = userEvent.setup();
    renderDialog();

    const group = wheelGroup('start verse number');
    await user.click(group);

    expect(within(group).getByTestId('wheel-rwp')).toHaveFocus();
  });

  test('saves the edited chapter:verse - chapter:verse reference', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await selectWheelByLabel(user, 'start verse number', '79');
    await selectWheelByLabel(user, 'end verse number', '3');
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
  test('shows the chapter as fixed text, verses as wheels', () => {
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
    expect(optionValues('start verse number')).toEqual(['1', '2', '3', '4']);
    expect(optionValues('end verse number')).toEqual(['1', '2', '3', '4']);
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
