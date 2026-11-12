import { Auth0Provider } from '@auth0/auth0-react';
import TokenChecked from './TokenChecked';
import envVariables from './auth0-variables.json';
const { auth0Domain, webClientId, apiIdentifier } = envVariables;

export const AuthApp: React.FC = () => {
  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={webClientId}
      useRefreshTokens={true}
      cacheLocation={
        (import.meta.env.VITE_AUTH_CACHE as 'localstorage' | 'memory') ||
        'memory'
      }
      authorizationParams={{
        audience: apiIdentifier,
        // In the dev server, return to whatever origin (and port) the app is
        // actually being served from, so `npm start -- --port N` round-trips
        // through Auth0 without hardcoding VITE_CALLBACK. Production builds keep
        // the configured callback. Both must be in Auth0's Allowed Callback URLs.
        redirect_uri: import.meta.env.DEV
          ? window.location.origin
          : import.meta.env.VITE_CALLBACK,
      }}
    >
      <TokenChecked />
    </Auth0Provider>
  );
};

export default AuthApp;
