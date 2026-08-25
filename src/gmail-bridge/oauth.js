const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export function buildAuthUrl({ clientId, redirectUri }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_READONLY_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function postToken(fields, fetch) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    body: new URLSearchParams(fields),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Gmail OAuth token request failed: HTTP ${res.status} ${data.error_description || data.error || ''}`.trim(),
    );
  }
  return data;
}

export async function exchangeCode({ clientId, clientSecret, code, redirectUri, fetch }) {
  const data = await postToken(
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    },
    fetch,
  );
  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken({ clientId, clientSecret, refreshToken, fetch }) {
  const data = await postToken(
    {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    },
    fetch,
  );
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
