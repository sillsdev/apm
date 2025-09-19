// See: https://www.w3schools.com/TAGS/ref_av_dom.asp
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
// import { act } from 'react-dom/test-utils';
import ProfileDialog, { ProfileDialogProps } from './ProfileDialog';
import { UnsavedProvider } from '../context/UnsavedContext';
import { UserD } from '../model';
import { memory } from '../schema';

const mockMemory = memory;
const mockOffline = false;
const mockOrgId = 'org1';
const mockUserId = 'user1';
const mocklang = 'en';
const mockOfflineOnly = false;
const mockDeveloper = false;
const mockUser: UserD[] = [];

jest.mock('../utils/logErrorService', () => jest.fn());
jest.mock('../utils/useWaitForRemoteQueue', () => ({
  useWaitForRemoteQueue: () => ({
    waitForRemoteQueue: jest.fn(),
  }),
}));
jest.mock('../store/localization/actions', () => ({
  setLanguage: jest.fn(),
}));
jest.mock('../crud/user', () => ({
  getUserRec: jest.fn(),
}));
jest.mock('../crud/useAddToOrgAndGroup', () => ({
  useAddToOrgAndGroup: jest.fn(),
}));
jest.mock('../crud/useRole', () => ({
  useRole: () => ({
    getMemberRoleRec: jest.fn(),
    userIsAdmin: false,
    userIsSharedContentAdmin: false,
  }),
}));
jest.mock('../crud/useTeamDelete', () => ({
  useTeamDelete: jest.fn(),
}));
jest.mock('../utils/useMyNavigate', () => ({
  useMyNavigate: jest.fn(),
}));
jest.mock('../control/SelectRole', () => {
  const MockedSelectRole = () => <div>SelectRole</div>;
  MockedSelectRole.displayName = 'SelectRole';
  return MockedSelectRole;
});
jest.mock('./ParatextLinkedButton', () => {
  const MockedParatextLinkedButton = () => <div>ParatextLinkedButton</div>;
  MockedParatextLinkedButton.displayName = 'ParatextLinkedButton';
  return MockedParatextLinkedButton;
});
jest.mock('./ExtendableDeleteExpansion', () => {
  const MockedExtendableDeleteExpansion = () => (
    <div>ExtendableDeleteExpansion</div>
  );
  MockedExtendableDeleteExpansion.displayName = 'ExtendableDeleteExpansion';
  return MockedExtendableDeleteExpansion;
});
jest.mock('./AltActionBar', () => {
  const MockedAltActionBar = () => <div>AltActionBar</div>;
  MockedAltActionBar.displayName = 'AltActionBar';
  return MockedAltActionBar;
});
jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: (recType: string) => (recType === 'user' ? mockUser : []),
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    add: 'Add',
    additionalSettings: 'Additional Settings',
    cancel: 'Cancel',
    deleteExplained:
      'Deleting your user will block you from using the program and remove references to your work. Are you sure you want to do this?',
    deleteUser: 'Delete User',
    deleteWarning: 'The following action cannot be undone:',
    edit: 'Edit Profile',
    family: 'Family Name',
    given: 'Given Name',
    locale: 'Preferred Language',
    locked: 'Locked',
    logout: 'Logout',
    name: 'Full Name',
    next: 'Next',
    phone: 'Phone',
    role: 'Team Role',
    save: 'Save',
    sendDigest: 'Receive Email Notifications and Digests',
    sharedContentCreator: 'Allow user to create shared content projects.',
    syncFrequency: 'Frequency of data sync in minutes.  0 to turn off sync.',
    syncFrequencyEnable: 'Enable Data Sync:',
    syncFrequencyLabel: 'Frequency:',
    timezone: 'Time zone',
    userExists: 'This offline user exists.',
  }),
  useDispatch: () => jest.fn(),
  shallowEqual: jest.fn(),
}));
jest.mock('../context/GlobalContext', () => ({
  useGlobal: (arg: string) =>
    arg === 'memory'
      ? [mockMemory, jest.fn()]
      : arg === 'offline'
        ? [mockOffline, jest.fn()]
        : arg === 'organization'
          ? [mockOrgId, jest.fn()]
          : arg === 'user'
            ? [mockUserId, jest.fn()]
            : arg === 'lang'
              ? [mocklang, jest.fn()]
              : arg === 'offlineOnly'
                ? [mockOfflineOnly, jest.fn()]
                : arg === 'developer'
                  ? [mockDeveloper, jest.fn()]
                  : [{}, jest.fn()],
  useGetGlobal: () => () => false, // remoteBusy & importexportBusy
}));

const runTest = (props: ProfileDialogProps) =>
  render(
    <UnsavedProvider>
      <ProfileDialog {...props} />
    </UnsavedProvider>
  );

describe('ProfileDialog', () => {
  beforeEach(cleanup);

  it('should render', async () => {
    const { container } = runTest({ mode: 'create', open: false });
    expect(container).not.toBe(null);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it('should render in viewMyAccount mode', async () => {
    const { container } = runTest({ mode: 'viewMyAccount', open: false });
    expect(container).not.toBe(null);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it('should render in editMember mode', async () => {
    const { container } = runTest({ mode: 'editMember', open: false });
    expect(container).not.toBe(null);
    await waitFor(() => expect(container).toBeTruthy());
  });
});
