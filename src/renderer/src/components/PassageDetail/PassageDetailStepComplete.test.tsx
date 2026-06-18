import React from 'react';
import { render, screen } from '@testing-library/react';

const mockStepComplete = jest.fn(() => false);
let mockTool: string;

jest.mock('../../context/usePassageDetailContext', () => () => ({
  currentstep: 'step-record',
  setCurrentStep: jest.fn(),
  stepComplete: mockStepComplete,
  setStepComplete: jest.fn(),
  setStepCompleteTo: jest.fn(),
  gotoNextStep: jest.fn(),
  psgCompleted: 0,
  section: { id: 's1', type: 'section' },
  recording: false,
  isBoldWorkflow: true,
  mediafileId: '',
}));

jest.mock('../../crud', () => {
  const { ToolSlug } = jest.requireActual<typeof import('../../crud/toolSlug')>(
    '../../crud/toolSlug'
  );
  return {
    ToolSlug,
    useStepTool: () => ({ tool: mockTool }),
  };
});

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoSectionStep: () => true,
    canAlwaysDoStep: () => true,
  }),
}));

jest.mock('../../utils', () => ({
  useMobile: () => ({ isMobile: false }),
}));

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/detail' }),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: () => [false, jest.fn()],
}));

jest.mock('../../selector', () => ({
  passageDetailStepCompleteSelector: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({ title: 'Complete', setNext: 'Set next' }),
  shallowEqual: jest.fn(),
}));

jest.mock('./usePassageNavigate', () => ({
  usePassageNavigate: () => jest.fn(),
}));

jest.mock('../../context/UnsavedContext', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: ReactActual.createContext({
      state: {
        isChanged: jest.fn(() => false),
        startSave: jest.fn(),
        waitForSave: jest.fn(),
      },
    }),
  };
});

jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

import PassageDetailStepComplete from './PassageDetailStepComplete';
import { ToolSlug } from '../../crud/toolSlug';

describe('PassageDetailStepComplete BOLD Record', () => {
  beforeEach(() => {
    mockTool = ToolSlug.Record;
  });

  it('renders on BOLD desktop Record step', () => {
    render(<PassageDetailStepComplete />);
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
  });

  it('disables complete checkbox when no saved mediafileId', () => {
    render(<PassageDetailStepComplete />);
    expect(screen.getByRole('button', { name: 'Complete' })).toBeDisabled();
  });
});

describe('PassageDetailStepComplete BOLD Careful Speech', () => {
  beforeEach(() => {
    mockTool = ToolSlug.CarefulSpeech;
  });

  it('renders step complete and bulk-complete controls on BOLD desktop', () => {
    render(<PassageDetailStepComplete />);
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set next' })).toBeInTheDocument();
  });
});
