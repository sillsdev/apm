import { jest, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: () => ({
    recognizeSpeechSettings: 'Settings',
    recognizeProgress: 'Progress',
  }),
}));

jest.mock('../../../hoc/BigDialog', () => {
  const MockBigDialog = (props: { children?: React.ReactNode }) => (
    <div>{props.children}</div>
  );
  MockBigDialog.displayName = 'MockBigDialog';
  return MockBigDialog;
});

jest.mock('../../../business/asr/SelectAsrLanguage', () => {
  const MockSelectAsrLanguage = () => null;
  MockSelectAsrLanguage.displayName = 'MockSelectAsrLanguage';
  return MockSelectAsrLanguage;
});

// Shows the verses AsrProgress is told to leave out of the result.
jest.mock('../../../business/asr/AsrProgress', () => {
  const MockAsrProgress = (props: { contentVerses?: string[] }) => (
    <div data-testid="skipped-verses">
      {(props.contentVerses ?? []).join(',')}
    </div>
  );
  MockAsrProgress.displayName = 'MockAsrProgress';
  return MockAsrProgress;
});

import { TranscribeAsrDialogs } from './TranscribeAsrDialogs';
import { BigDialogBp } from '../../../hoc/BigDialogBp';

const renderDialogs = (replaceAsr: boolean) =>
  render(
    <TranscribeAsrDialogs
      team={undefined}
      mediaId="m1"
      asrLangVisible={false}
      asrProgressVisible
      phonetic={false}
      asrOverride={undefined}
      forceAsr={false}
      replaceAsr={replaceAsr}
      contentVerses={['1', '2']}
      onLanguageClose={jest.fn()}
      onProgressOpen={jest.fn()}
      setTranscription={jest.fn()}
      bp={BigDialogBp.sm}
    />
  );

describe('TranscribeAsrDialogs', () => {
  it('skips verses that already have content when appending', () => {
    renderDialogs(false);
    expect(screen.getByTestId('skipped-verses').textContent).toBe('1,2');
  });

  // TT-7856: a replacing result resumed without force must keep every verse.
  it('skips no verse when the result replaces the transcription', () => {
    renderDialogs(true);
    expect(screen.getByTestId('skipped-verses').textContent).toBe('');
  });
});
