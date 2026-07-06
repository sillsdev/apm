import { Auth0Provider } from '@auth0/auth0-react';
import TokenChecked from './TokenChecked';
import envVariables from './auth0-variables.json';
const { auth0Domain, webClientId, apiIdentifier } = envVariables;

export const AuthApp: React.FC = () => {
  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={webClientId}
      // useRefreshTokens is a top-level Auth0Provider option (from
      // @auth0/auth0-spa-js Auth0ClientOptions), not an authorization param.
      // Nested inside authorizationParams it is sent to /authorize as an
      // unrecognized query param and refresh-token rotation stays disabled.
      useRefreshTokens={true}
      cacheLocation={
        (import.meta.env.VITE_AUTH_CACHE as 'localstorage' | 'memory') ||
        'memory'
      }
      authorizationParams={{
        audience: apiIdentifier,
        redirect_uri: import.meta.env.VITE_CALLBACK,
      }}
    >
      <TokenChecked />
    </Auth0Provider>
  );
};

export default AuthApp;
