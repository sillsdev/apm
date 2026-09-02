import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SpeakerName from './SpeakerName';

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'organization') return ['org1', jest.fn()];
    if (key === 'memory') return [{}, jest.fn()];
    return [undefined, jest.fn()];
  },
}));

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: () => [{ attributes: { rightsHolder: 'Alice' } }],
}));

jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../crud', () => ({
  ArtifactTypeSlug: { IntellectualProperty: 'intellectualproperty' },
  findRecord: jest.fn(),
  related: () => 'org1',
}));


jest.mock('react-redux', () => ({
  useSelector: () => ({
    selectSpeaker: 'Select Speaker',
    addSpeaker: 'Add {0}',
    speaker: 'Speaker',
    noVoiceCreation: 'No voice creation',
    voiceRights: 'Voice rights',
    releaseRights: 'Release rights',
    cancel: 'Cancel',
  }),
  shallowEqual: (a: unknown, b: unknown) => a === b,
}));

jest.mock('./ProvideRights', () => () => null);

const theme = createTheme();

/** Same rights-gate MediaUploadContent uses for the upload-audio speaker field. */
function UploadSpeakerField() {
  const [speaker, setSpeaker] = useState('');
  const [hasRights, setHasRights] = useState(false);
  return (
    <SpeakerName
      name={hasRights ? speaker || '' : ''}
      onRights={setHasRights}
      onChange={setSpeaker}
      team="org1"
      aiip={false}
    />
  );
}

function renderUploadSpeaker() {
  return render(
    <ThemeProvider theme={theme}>
      <UploadSpeakerField />
    </ThemeProvider>
  );
}

describe('SpeakerName upload dialog (mobile)', () => {
  it('shows the chosen existing speaker after select (rights-gated name)', async () => {
    renderUploadSpeaker();

    fireEvent.click(screen.getByRole('button', { name: 'Select Speaker...' }));

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Alice' }));

    expect(
      await screen.findByRole('button', { name: 'Alice' })
    ).toBeInTheDocument();
  });
});
