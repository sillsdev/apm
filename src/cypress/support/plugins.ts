// @ts-ignore this is a e2e testing plugin
import cyDataSession from 'cypress-data-session/src/plugin';
import muteBrowserAudio from './muteBrowserAudio';

/**
 * The collection of plugins to use with Cypress
 * @param on  `on` is used to hook into various events Cypress emits
 * @param config  `config` is the resolved Cypress config
 */
export default function plugins(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
) {
  muteBrowserAudio(on);
  return {
    // add plugins here
    ...cyDataSession(on, config),
  };
}
