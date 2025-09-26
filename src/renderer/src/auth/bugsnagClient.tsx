import Bugsnag from '@bugsnag/js'
import BugsnagReact from '@bugsnag/plugin-react'
import {API_CONFIG} from '../api-variable'
import packageJson from '../../package.json'

const prodOrQa = API_CONFIG.snagId !== ''

const prod = API_CONFIG.host.indexOf('api.') !== -1

export const bugsnagClient = prodOrQa
  ? Bugsnag.start({
      hostname: API_CONFIG.endpoint,
      apiKey: API_CONFIG.snagId,
      plugins: [new BugsnagReact()],
      appVersion: packageJson.version,
      releaseStage: prod ? 'production' : 'staging',
      autoTrackSessions: false,
      endpoints: {
        notify: API_CONFIG.notify,
        sessions: API_CONFIG.sessions,
      },
    })
  : undefined

export default bugsnagClient
