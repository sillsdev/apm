/* eslint-disable @typescript-eslint/no-explicit-any */
import { MountOptions, MountReturn } from 'cypress/react';
import type { InstallRecordingMocksOptions } from './cypress/support/recordingMocks';
import type { RecordingMockHelpers } from './cypress/support/recordingMocks';

export {};
declare global {
  namespace Cypress {
    interface SuiteConfigOverrides {
      /** @see @cypress/grep */
      tags?: string | string[];
    }

    interface TestConfigOverrides {
      /** @see @cypress/grep */
      tags?: string | string[];
    }

    interface Chainable {
      /** Yields elements with a data-cy attribute that matches a specified selector.
       * ```
       * cy.getByCy('search-toggle') // where the selector is [data-cy="search-toggle"]
       * ```
       */
      getByCy(qaSelector: string, args?: any): Chainable<JQuery<HTMLElement>>;

      /** Yields elements with data-cy attribute that partially matches a specified selector.
       * ```
       * cy.getByCyLike('chat-button') // where the selector is [data-cy="chat-button-start-a-new-claim"]
       * ```
       */
      getByCyLike(
        qaSelector: string,
        args?: any
      ): Chainable<JQuery<HTMLElement>>;

      /** Mounts a React node
       * @param component React Node to mount
       * @param options Additional options to pass into mount
       */
      mount(
        component: React.ReactNode,
        options?: MountOptions
      ): Cypress.Chainable<MountReturn>;

      /**
       * Logs in via Auth0 Universal Login using cy.origin() and caches the session.
       * Reads credentials from Cypress env: auth0_username, auth0_password, auth0_domain.
       */
      loginByAuth0(): Chainable<void>;

      /** Install getUserMedia / recording browser mocks before mounting MediaRecord. */
      installRecordingMocks(
        options?: InstallRecordingMocksOptions
      ): Chainable<RecordingMockHelpers>;
    }
  }
}
