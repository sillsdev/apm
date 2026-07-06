import envVariables from './auth0-variables.json';
import { jwtDecode } from 'jwt-decode';
import { net } from 'electron';
import url from 'url';
import keytar from 'keytar';
import os from 'os';

const redirectUri = 'http://localhost/callback';

const keytarService = 'electron-openid-oauth';
const keytarAccount = os.userInfo().username;
const { apiIdentifier, auth0Domain, desktopId } = envVariables;

let accessToken = null;
let profile = null;
let refreshToken = null;

export function getAccessToken() {
  return accessToken;
}

export function getProfile() {
  return profile;
}

export function getAuthenticationURL(hasUsed, email) {
  const dev = envVariables.auth0Domain.indexOf('-dev') > 0;
  return (
    `https://${auth0Domain}/authorize?` +
    `audience=${apiIdentifier}&` +
    'scope=openid email profile offline_access&' +
    'response_type=code&' +
    (!hasUsed && dev
      ? 'login_hint=signUp&'
      : !hasUsed && !dev
        ? 'mode=signUp&'
        : hasUsed && email
          ? `login_hint=${encodeURIComponent(email)}&`
          : '') +
    `client_id=${desktopId}&` +
    `redirect_uri=${redirectUri}`
  );
}

// ponytail: Chromium net.fetch shares the browser TLS/proxy path; Node axios
// socket hang up behind corporate SSL inspection on /oauth/token.
const RETRYABLE = /socket hang up|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i;

async function postOAuthToken(
  body: Record<string, string>
): Promise<Record<string, string>> {
  const tokenUrl = `https://${auth0Domain}/oauth/token`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await net.fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return JSON.parse(text) as Record<string, string>;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!RETRYABLE.test(message) || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

export async function refreshTokens() {
  const refreshToken = await keytar.getPassword(keytarService, keytarAccount);

  if (refreshToken) {
    try {
      const response = await postOAuthToken({
        grant_type: 'refresh_token',
        client_id: desktopId,
        refresh_token: refreshToken,
      });

      accessToken = response.access_token;
      profile = jwtDecode(response.id_token);
    } catch (error) {
      await logout();

      throw error;
    }
  } else {
    throw new Error('No available refresh token.');
  }
}

export async function loadTokens(callbackURL) {
  const urlParts = url.parse(callbackURL, true);
  const query = urlParts.query;
  const code = query.code as string | undefined;
  if (!code) {
    throw new Error('loadTokens: missing authorization code in callback URL');
  }

  try {
    const response = await postOAuthToken({
      grant_type: 'authorization_code',
      client_id: desktopId,
      code,
      redirect_uri: redirectUri,
    });

    accessToken = response.access_token;
    profile = jwtDecode(response.id_token);
    refreshToken = response.refresh_token;

    if (refreshToken) {
      await keytar.setPassword(keytarService, keytarAccount, refreshToken);
    }
  } catch (error) {
    // Do not logout() here — that wipes a valid keytar refresh token on a
    // transient network failure after Auth0 already issued a code.
    accessToken = null;
    profile = null;
    refreshToken = null;
    throw error;
  }
}

export async function logout() {
  await keytar.deletePassword(keytarService, keytarAccount);
  accessToken = null;
  profile = null;
  refreshToken = null;
}

export function getLogOutUrl() {
  return `https://${auth0Domain}/v2/logout`;
}

export function getGoogleLogOutUrl() {
  return `https://accounts.google.com/Logout`;
}
