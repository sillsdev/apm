// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import ConsultantCheckCompare from './ConsultantCheckCompare';

jest.mock('react-redux', () => ({
  useSelector: () => ({
    cancel: 'Cancel',
    save: 'Save',
  }),
  shallowEqual: jest.fn(),
}));
jest.mock('../../crud', () => ({
  useArtifactType: () => ({
    localizedArtifactType: (item: string) => item,
  }),
}));
jest.mock('../../selector', () => ({
  sharedSelector: jest.fn(),
}));
jest.mock('../../control', () => ({
  ActionRow: jest.requireActual('../../control/ActionRow').ActionRow,
  Button: jest.requireActual('../../control/Button').Button,
  GrowingDiv: jest.requireActual('../../control/GrowingDiv').GrowingDiv,
  // rowSx is a theme callback needing the app theme augmentation; the plain
  // object keeps the Box happy without a ThemeProvider.
  rowSx: {},
}));

describe('ConsultantCheckCompare', () => {
  beforeEach(cleanup);

  it('should render ConsultantCheckCompare', () => {
    const props = {
      compare: [],
      allItems: [],
      onChange: () => {},
    };

    const { container } = render(<ConsultantCheckCompare {...props} />);
    expect(container).not.toBe(null);
  });

  it('should render ConsultantCheckCompare with compare', () => {
    const props = {
      compare: ['1'],
      allItems: ['1', '2'],
      onChange: () => {},
    };

    const { container } = render(<ConsultantCheckCompare {...props} />);
    expect(container).not.toBe(null);
  });

  it('should render ConsultantCheckCompare with allItems', () => {
    const props = {
      compare: [],
      allItems: ['1', '2'],
      onChange: () => {},
    };

    const { container } = render(<ConsultantCheckCompare {...props} />);
    expect(container).not.toBe(null);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should render ConsultantCheckCompare with allItems and compare', () => {
    const props = {
      compare: ['1'],
      allItems: ['1', '2'],
      onChange: () => {},
    };

    const { container } = render(<ConsultantCheckCompare {...props} />);
    expect(container).not.toBe(null);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-0')).toHaveClass('Mui-checked');
    expect(screen.getByTestId('checkbox-1')).not.toHaveClass('Mui-checked');
  });

  it('should return compare value if cancel is clicked', () => {
    const props = {
      compare: ['1'],
      allItems: ['1', '2'],
      onChange: jest.fn(),
    };

    const { container } = render(<ConsultantCheckCompare {...props} />);
    expect(container).not.toBe(null);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-0')).toHaveClass('Mui-checked');
    expect(screen.getByTestId('checkbox-1')).not.toHaveClass('Mui-checked');

    screen.getByRole('button', { name: 'Cancel' }).click();

    expect(props.onChange).toHaveBeenCalledWith(['1']);
  });

  it('should have save disabled if one item clicked', () => {
    const props = {
      compare: ['1'],
      allItems: ['1', '2'],
      onChange: jest.fn(),
    };

    const { container } = render(<ConsultantCheckCompare {...props} />);
    expect(container).not.toBe(null);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-0')).toHaveClass('Mui-checked');
    expect(screen.getByTestId('checkbox-1')).not.toHaveClass('Mui-checked');

    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'Mui-disabled'
    );
  });

  it('should not save if nothing has changed', () => {
    const props = {
      compare: ['1', '2'],
      allItems: ['1', '2', '3'],
      onChange: jest.fn(),
    };

    const { container } = render(<ConsultantCheckCompare {...props} />);
    expect(container).not.toBe(null);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-0')).toHaveClass('Mui-checked');
    expect(screen.getByTestId('checkbox-1')).toHaveClass('Mui-checked');
    expect(screen.getByTestId('checkbox-2')).not.toHaveClass('Mui-checked');

    screen.getByRole('button', { name: 'Save' }).click();

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('should return allItems value if save is clicked after checking 2', () => {
    const props = {
      compare: ['1'],
      allItems: ['1', '2'],
      onChange: jest.fn(),
    };

    const { container } = render(<ConsultantCheckCompare {...props} />);
    expect(container).not.toBe(null);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-0')).toHaveClass('Mui-checked');
    expect(screen.getByTestId('checkbox-1')).not.toHaveClass('Mui-checked');

    act(() => {
      screen.getByTestId('checkbox-1').click();
    });
    screen.getByRole('button', { name: 'Save' }).click();

    expect(props.onChange).toHaveBeenCalledWith(['1', '2']);
  });
});
