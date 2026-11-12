describe('Authentication and project list', () => {
  it('logs in and sees Personal Audio Projects', () => {
    cy.loginByAuth0(); // establishes session; ends on about:blank with token in localStorage
    cy.visit('/'); // app loads, auth0-spa-js finds cached token — no redirect needed
    cy.contains('Personal Audio Projects', { timeout: 30000 }).should(
      'be.visible'
    );
  });
});
