// put e2e + CT common commands here

// @ts-expect-error // @see error 2306 https://github.com/microsoft/TypeScript/blob/3fcd1b51a1e6b16d007b368229af03455c7d5794/src/compiler/diagnosticMessages.json#L1635
import registerCypressGrep from '@cypress/grep';
registerCypressGrep();

Cypress.Commands.add('getByCy', (selector, ...args) =>
  cy.get(`[data-cy="${selector}"]`, ...args)
);

Cypress.Commands.add('getByCyLike', (selector, ...args) =>
  cy.get(`[data-cy*=${selector}]`, ...args)
);

// Logs in via Auth0 Universal Login using cy.origin() to cross the domain boundary.
// With VITE_AUTH_CACHE=localstorage, auth0-spa-js writes the token to localStorage so
// cy.session() can save and restore it — avoiding a full Auth0 round-trip on every test.
Cypress.Commands.add('loginByAuth0', () => {
  cy.env(['auth0_domain', 'auth0_username', 'auth0_password']).then(
    ({ auth0_domain, auth0_username, auth0_password }) => {
      cy.session(
        [auth0_username],
        () => {
          cy.visit('/access/online-cloud');
          cy.url({ timeout: 20000 }).should('include', auth0_domain);
          cy.origin(
            `https://${auth0_domain}`,
            { args: { username: auth0_username, password: auth0_password } },
            ({ username, password }) => {
              cy.get('input[name="email"]').type(username);
              cy.get('input[name="password"]').type(password, { log: false });
              cy.get('button[type="submit"]').click();
            }
          );
          // Auth0 redirects back; wait for auth0-spa-js to store the token in localStorage
          cy.url({ timeout: 20000 }).should('include', 'localhost:3000');
          cy.window({ timeout: 20000 }).should((win) => {
            expect(
              Object.keys(win.localStorage).some((k) =>
                k.startsWith('@@auth0spajs@@')
              )
            ).to.be.true;
          });
        },
        { cacheAcrossSpecs: true }
      );
    }
  );
});
