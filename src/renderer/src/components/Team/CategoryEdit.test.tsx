import React from 'react';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react';
import { ArtifactCategoryType, IArtifactCategory } from '../../crud';
import CategoryEdit from './CategoryEdit';

const mockOffline = { current: false };
const mockOpen = jest.fn();

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'offline') return [mockOffline.current, jest.fn()];
    if (key === 'memory') return [{ keyMap: {} }, jest.fn()];
    if (key === 'coordinator')
      return [{ getSource: () => undefined }, jest.fn()];
    return [undefined, jest.fn()];
  },
}));

jest.mock('../../crud', () => ({
  ArtifactCategoryType: { Note: 'note', Resource: 'resource' },
  remoteIdNum: () => 1,
  useArtifactCategory: () => ({
    isDuplicateCategory: jest.fn(async () => false),
    localizedArtifactCategory: (c: string) => c,
    defaultMediaName: () => 'file',
  }),
  useGraphicCreate: () => jest.fn(),
  useGraphicUpdate: () => jest.fn(),
}));

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => [],
}));

jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    duplicate: 'dup',
    close: 'Close',
    saving: 'saving',
    uploadSuccess: 'ok',
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../../control/MediaTitle', () => ({
  __esModule: true,
  default: () => <div data-testid="media-title" />,
}));

jest.mock('../../control/Button', () => ({
  Button: (props: {
    onClick?: () => void;
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) => (
    <button onClick={props.onClick} style={props.style}>
      {props.children}
    </button>
  ),
}));

jest.mock('@uiw/react-color-colorful', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../GraphicPicker', () => ({
  __esModule: true,
  default: () => <div data-testid="graphic-picker" />,
}));

jest.mock('../useGraphicPicker', () => ({
  saveGraphicRecord: jest.fn(),
  useGraphicPicker: () => ({
    open: mockOpen,
    isOpen: false,
    onOpen: jest.fn(),
    cancelled: { current: false },
    showMessage: jest.fn(),
    dimension: 1024,
    finish: jest.fn(),
    onSelectedRights: jest.fn(),
    currentUrl: '',
    currentRights: '',
    setCurrentUrl: jest.fn(),
    setCurrentRights: jest.fn(),
  }),
}));

jest.mock('../apmGraphic', () => ({
  apmGraphic: () => ({ graphicUri: '', url: '', graphicRights: '' }),
}));

jest.mock('../../crud/syncToMemory', () => ({
  recToMemory: jest.fn(),
}));

const category: IArtifactCategory = {
  id: 'cat-1',
  slug: 'note',
  category: 'Note',
  org: 'org-1',
  titleMediaId: '',
  color: '#ffffff',
  specialuse: '',
};

const renderEdit = () =>
  render(
    <CategoryEdit
      category={category}
      type={ArtifactCategoryType.Note}
      mediaplan="plan-1"
      onChanged={jest.fn()}
      onDeleted={jest.fn()}
      onRecording={jest.fn()}
      disabled={false}
    />
  );

describe('CategoryEdit graphic', () => {
  beforeEach(() => {
    mockOpen.mockClear();
    mockOffline.current = false;
  });

  it('opens the graphic picker when online', () => {
    renderEdit();
    fireEvent.click(
      document.getElementById(`cat-graphic-${category.id}`) as HTMLButtonElement
    );
    expect(mockOpen).toHaveBeenCalled();
  });

  it('does not open the graphic picker when offline', () => {
    mockOffline.current = true;
    renderEdit();
    const btn = document.getElementById(
      `cat-graphic-${category.id}`
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
