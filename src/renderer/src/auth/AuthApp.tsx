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
        redirect_uri: import.meta.env.VITE_CALLBACK,
      }}
    >
      <TokenChecked />
    </Auth0Provider>
  );
};

export default AuthApp;
