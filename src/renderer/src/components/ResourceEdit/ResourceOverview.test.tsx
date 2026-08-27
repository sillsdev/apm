import React from 'react';
import { render, screen } from '@testing-library/react';
import Mode from '../../model/dialogMode';

const mockOnLink = jest.fn();
const mockOnUnlink = jest.fn();

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'developer') return [false];
    return [undefined];
  },
}));

jest.mock('../../crud', () => ({
  orgDefaultResKw: 'reskw',
  useOrgDefaults: () => ({
    getOrgDefault: () => '',
    setOrgDefault: jest.fn(),
    canSetOrgDefault: false,
  }),
}));

jest.mock('../../selector', () => ({
  sharedResourceSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    findNote: 'Find existing note',
    unlinkNote: 'Unlink',
    title: 'Title',
    description: 'Description',
    add: 'Add',
    delete: 'Delete',
    source: 'Linked Note Source: ',
    changes:
      'Edit this note in the project where it was created. Changes there apply to all linked locations.',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../../control', () => ({
  ActionRow: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Button: (props: {
    id?: string;
    onClick?: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => (
    <button id={props.id} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  ),
  GrowingDiv: () => null,
  LightTooltip: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  Language: () => null,
  // rowSx is a theme callback needing the app theme augmentation; the plain
  // object keeps the Box happy without a ThemeProvider.
  rowSx: {},
}));

jest.mock('./NoteTitle', () => ({
  NoteTitle: () => <div data-testid="note-title" />,
}));
jest.mock('./ResourceTitle', () => ({
  ResourceTitle: () => <div data-testid="resource-title" />,
}));
jest.mock('./ResourceDescription', () => ({
  ResourceDescription: () => <div data-testid="description" />,
}));
jest.mock('./ResourceCategory', () => ({
  ResourceCategory: () => <div data-testid="category" />,
}));
jest.mock('./ResourceKeywords', () => ({
  ResourceKeywords: () => <div data-testid="keywords" />,
}));
jest.mock('./ResourceTerms', () => ({
  ResourceTerms: () => null,
}));
jest.mock('./ResourceLink', () => ({
  ResourceLink: () => <div data-testid="link" />,
}));
jest.mock('./SelectNote', () => {
  const MockSelectNote = () => <div data-testid="select-note" />;
  MockSelectNote.displayName = 'MockSelectNote';
  return MockSelectNote;
});
jest.mock('./ResourceRefs', () => ({ __esModule: true, default: () => null }));
jest.mock('../../utils', () => ({}));

import ResourceOverview from './ResourceOverview';

describe('ResourceOverview linked note (TT-5873)', () => {
  const values = {
    title: 'Shared note',
    mediaId: '',
    description: '',
    bcp47: 'und',
    languageName: '',
    font: '',
    rtl: false,
    spellCheck: false,
    terms: '',
    keywords: '',
    linkurl: '',
    note: true,
    category: '',
    changed: false,
    ws: undefined,
    onRecording: jest.fn(),
  };

  it('keeps Find Note and Unlink, hides Save when content is read-only', () => {
    render(
      <ResourceOverview
        mode={Mode.edit}
        dialogmode={Mode.edit}
        values={values}
        isOpen={true}
        isNote={true}
        ws={undefined}
        onOpen={jest.fn()}
        onCommit={jest.fn()}
        onLink={mockOnLink}
        onUnlink={mockOnUnlink}
        contentReadOnly={true}
      />
    );
    expect(document.getElementById('findNote')).not.toBeNull();
    expect(document.getElementById('findNote')).not.toBeDisabled();
    expect(document.getElementById('unlinkNote')).not.toBeNull();
    expect(document.getElementById('resSave')).toBeNull();
    expect(screen.getByTestId('note-title')).toBeTruthy();
  });

  it('shows Save on a source note that is not read-only', () => {
    render(
      <ResourceOverview
        mode={Mode.edit}
        dialogmode={Mode.edit}
        values={values}
        isOpen={true}
        isNote={true}
        ws={undefined}
        onOpen={jest.fn()}
        onCommit={jest.fn()}
        onLink={mockOnLink}
        contentReadOnly={false}
      />
    );
    expect(document.getElementById('resSave')).not.toBeNull();
    expect(document.getElementById('unlinkNote')).toBeNull();
  });
});
