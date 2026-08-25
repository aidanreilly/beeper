export async function fetchUnreadCount({ accessToken, query, fetch }) {
  const q = encodeURIComponent(query);
  const maxResults = encodeURIComponent('1');
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${maxResults}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gmail API request failed: HTTP ${res.status} ${data.error?.message || ''}`.trim());
  }
  return Number(data.resultSizeEstimate ?? 0);
}
