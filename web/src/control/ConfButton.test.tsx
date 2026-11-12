import { fireEvent, render, screen } from '@testing-library/react';
import ConfButton from './ConfButton';

describe('ConfButton', () => {
  it('names the settings segment for assistive tech', () => {
    render(
      <ConfButton settingsLabel="Speech settings" onSettings={jest.fn()}>
        Run
      </ConfButton>
    );
    expect(
      screen.getByRole('button', { name: 'Speech settings' })
    ).toBeInTheDocument();
  });

  it('disables settings along with the main button by default', () => {
    const onSettings = jest.fn();
    render(
      <ConfButton
        disabled
        settingsLabel="Speech settings"
        onSettings={onSettings}
      >
        Run
      </ConfButton>
    );
    const settings = screen.getByRole('button', { name: 'Speech settings' });
    expect(settings).toBeDisabled();
    fireEvent.click(settings);
    expect(onSettings).not.toHaveBeenCalled();
  });

  it('keeps settings enabled when allowSettings is set', () => {
    render(
      <ConfButton disabled allowSettings settingsLabel="Speech settings">
        Run
      </ConfButton>
    );
    expect(
      screen.getByRole('button', { name: 'Speech settings' })
    ).toBeEnabled();
  });
});
