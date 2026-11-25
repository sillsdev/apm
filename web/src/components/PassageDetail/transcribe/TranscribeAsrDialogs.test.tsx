import { jest, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useSelector: () => ({
    asrReplaceExisting: 'Replace the existing transcription?',
    asrReplace: 'Replace',
    asrInsert: 'Insert',
  }),
}));

jest.mock('../../../utils/useMobile', () => ({
  useMobile: () => ({ isMobile: false }),
}));

jest.mock('../../../hoc/BigDialog', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../../business/asr/SelectAsrLanguage', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../business/asr/AsrProgress', () => ({
  __esModule: true,
  default: () => null,
}));

import { TranscribeAsrDialogs } from './TranscribeAsrDialogs';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import type { AsrResult } from '../../../business/asr/useAsrTaskLifecycle';

const renderDialogs = (result?: AsrResult) => {
  const onAsrReplace = jest.fn();
  const onAsrInsert = jest.fn();
  const onAsrDismiss = jest.fn();
  render(
    <TranscribeAsrDialogs
      team={undefined}
      mediaId="m1"
      asrLangVisible={false}
      asrProgressVisible={false}
      phonetic={false}
      asrOverride={undefined}
      forceAsr={false}
      onLanguageClose={jest.fn()}
      onProgressOpen={jest.fn()}
      onAsrResult={jest.fn()}
      asrPrompt={
        result && {
          result,
          onReplace: onAsrReplace,
          onInsert: onAsrInsert,
          onDismiss: onAsrDismiss,
        }
      }
      bp={BigDialogBp.sm}
    />
  );
  return { onAsrReplace, onAsrInsert, onAsrDismiss };
};

const pending: AsrResult = { full: '\\v 1 new' };

describe('TranscribeAsrDialogs replace prompt', () => {
  it('does not ask when no result is waiting', () => {
    renderDialogs();
    expect(
      screen.queryByText('Replace the existing transcription?')
    ).toBeNull();
  });

  it('asks Replace or Insert when a result is waiting', () => {
    renderDialogs(pending);
    expect(
      screen.getByText('Replace the existing transcription?')
    ).toBeTruthy();
  });

  it('replaces when the user picks Replace', () => {
    const { onAsrReplace, onAsrInsert } = renderDialogs(pending);
    fireEvent.click(screen.getByText('Replace'));
    expect(onAsrReplace).toHaveBeenCalled();
    expect(onAsrInsert).not.toHaveBeenCalled();
  });

  it('inserts when the user picks Insert', () => {
    const { onAsrReplace, onAsrInsert } = renderDialogs(pending);
    fireEvent.click(screen.getByText('Insert'));
    expect(onAsrInsert).toHaveBeenCalled();
    expect(onAsrReplace).not.toHaveBeenCalled();
  });

  it('neither inserts nor replaces when the prompt is dismissed', () => {
    const { onAsrReplace, onAsrInsert, onAsrDismiss } = renderDialogs(pending);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onAsrDismiss).toHaveBeenCalled();
    expect(onAsrInsert).not.toHaveBeenCalled();
    expect(onAsrReplace).not.toHaveBeenCalled();
  });
});
