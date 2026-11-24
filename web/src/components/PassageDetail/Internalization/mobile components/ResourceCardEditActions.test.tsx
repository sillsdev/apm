import { fireEvent, render, screen } from '@testing-library/react';
import { ResourceCardEditActions } from './ResourceCardEditActions';
import { IRow } from '../../../../context/PassageDetailContext';

let mockIsMobileWidth = false;
jest.mock('../../../../utils/useMobile', () => ({
  useMobile: () => ({ isMobileWidth: mockIsMobileWidth }),
}));
jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: () => ({ edit: 'Edit', delete: 'Delete' }),
}));
jest.mock('../../../../selector', () => ({ mediaActionsSelector: jest.fn() }));

const row = { id: 'r1', artifactName: 'Genesis notes' } as IRow;

describe('ResourceCardEditActions', () => {
  beforeEach(() => {
    mockIsMobileWidth = false;
  });

  it('edits and deletes its row', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    render(
      <ResourceCardEditActions row={row} onEdit={onEdit} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByLabelText('Edit Genesis notes'));
    fireEvent.click(screen.getByLabelText('Delete Genesis notes'));
    expect(onEdit).toHaveBeenCalledWith('r1');
    expect(onDelete).toHaveBeenCalledWith('r1');
  });

  it('shows only the actions it is given', () => {
    render(<ResourceCardEditActions row={row} onEdit={jest.fn()} />);
    expect(screen.getByLabelText('Edit Genesis notes')).toBeInTheDocument();
    expect(screen.queryByLabelText('Delete Genesis notes')).toBeNull();
  });

  it('is hidden at phone width', () => {
    mockIsMobileWidth = true;
    const { container } = render(
      <ResourceCardEditActions
        row={row}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
