import ConfButton from './ConfButton';
import TranscriptionLogo from './TranscriptionLogo';

// Same contents as the AI Automatic Transcription button in the bold-clause editor.
const mountAsrButton = () => {
  cy.mount(
    <ConfButton
      id="asr"
      settingsLabel="Speech settings"
      onClick={cy.stub()}
      onSettings={cy.stub()}
    >
      <TranscriptionLogo sx={{ height: 18, width: 18, mr: 1 }} />
      AI Automatic Transcription
    </ConfButton>
  );
};

describe('ConfButton', () => {
  it('draws the settings segment the same height as the main button', () => {
    mountAsrButton();
    cy.get('#asr').then(($main) => {
      const mainBox = $main[0].getBoundingClientRect();
      cy.get('[aria-label="Speech settings"]').then(($gear) => {
        const gearBox = $gear[0].getBoundingClientRect();
        expect(gearBox.top).to.be.closeTo(mainBox.top, 0.5);
        expect(gearBox.height).to.be.closeTo(mainBox.height, 0.5);
        // Both use the theme's small button height.
        expect(mainBox.height).to.be.closeTo(28, 0.5);
      });
    });
  });

  it('centres the logo vertically in the main button', () => {
    mountAsrButton();
    cy.get('#asr').then(($main) => {
      const mainBox = $main[0].getBoundingClientRect();
      cy.get('#asr img').then(($logo) => {
        const logoBox = $logo[0].getBoundingClientRect();
        const mainMiddle = mainBox.top + mainBox.height / 2;
        const logoMiddle = logoBox.top + logoBox.height / 2;
        expect(logoMiddle).to.be.closeTo(mainMiddle, 1);
      });
    });
  });
});
