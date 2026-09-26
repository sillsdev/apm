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

let accessToken: string | null = null;
let profile: ReturnType<typeof jwtDecode> | null = null;

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
const OAUTH_TOKEN_TIMEOUT_MS = 5000;
const RETRYABLE = /socket hang up|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i;

type OAuthTokenResponse = {
  access_token: string;
  id_token: string;
  refresh_token?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseOAuthTokenResponse(body: unknown): OAuthTokenResponse {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('oauth/token: response is not a JSON object');
  }
  const record = body as Record<string, unknown>;
  if (!isNonEmptyString(record.access_token)) {
    throw new Error('oauth/token: missing or invalid access_token');
  }
  if (!isNonEmptyString(record.id_token)) {
    throw new Error('oauth/token: missing or invalid id_token');
  }
  const tokens: OAuthTokenResponse = {
    access_token: record.access_token,
    id_token: record.id_token,
  };
  if (record.refresh_token !== undefined) {
    if (!isNonEmptyString(record.refresh_token)) {
      throw new Error('oauth/token: invalid refresh_token');
    }
    tokens.refresh_token = record.refresh_token;
  }
  return tokens;
}

function setSessionFromTokenResponse(tokens: OAuthTokenResponse): void {
  const decoded = jwtDecode(tokens.id_token);
  accessToken = tokens.access_token;
  profile = decoded;
}

// ponytail: import-time self-check; upgrade path: jest when main has a runner
function oauthTokenParseSelfCheck(): void {
  const ok = parseOAuthTokenResponse({
    access_token: 'at',
    id_token: 'it',
    refresh_token: 'rt',
  });
  if (ok.refresh_token !== 'rt') {
    throw new Error('oauth token self-check: refresh_token');
  }
  for (const body of [
    {},
    { access_token: '' },
    { access_token: 'a', id_token: 1 },
  ]) {
    try {
      parseOAuthTokenResponse(body);
      throw new Error('oauth token self-check: expected throw');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('oauth/token:')) {
        continue;
      }
      throw error;
    }
  }
}
if (process.env.NODE_ENV !== 'production') {
  oauthTokenParseSelfCheck();
}

function isRetryableTokenError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'TimeoutError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE.test(message);
}

async function postOAuthToken(
  body: Record<string, string>,
  maxAttempts = 3
): Promise<OAuthTokenResponse> {
  const tokenUrl = `https://${auth0Domain}/oauth/token`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await net.fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(OAUTH_TOKEN_TIMEOUT_MS),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('oauth/token: response is not valid JSON');
      }
      return parseOAuthTokenResponse(parsed);
    } catch (error) {
      lastError = error;
      if (!isRetryableTokenError(error) || attempt === maxAttempts) break;
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

      setSessionFromTokenResponse(response);
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
    // Authorization codes are single-use; retry can turn a network error into HTTP 400.
    const response = await postOAuthToken(
      {
        grant_type: 'authorization_code',
        client_id: desktopId,
        code,
        redirect_uri: redirectUri,
      },
      1
    );

    if (!response.refresh_token) {
      throw new Error('oauth/token: missing refresh_token');
    }
    setSessionFromTokenResponse(response);
    await keytar.setPassword(
      keytarService,
      keytarAccount,
      response.refresh_token
    );
  } catch (error) {
    // Do not logout() here — that wipes a valid keytar refresh token on a
    // transient network failure after Auth0 already issued a code.
    accessToken = null;
    profile = null;
    throw error;
  }
}

export async function logout() {
  await keytar.deletePassword(keytarService, keytarAccount);
  accessToken = null;
  profile = null;
}

export function getLogOutUrl() {
  return `https://${auth0Domain}/v2/logout`;
}

export function getGoogleLogOutUrl() {
  return `https://accounts.google.com/Logout`;
}
