import { getGoogleConnectionByUserId, upsertGoogleConnection } from "@/lib/db-helpers";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

export type GoogleConnection = Awaited<ReturnType<typeof getGoogleConnectionByUserId>>;

/** Returns a valid access token, refreshing if needed. Throws if disconnected. */
export async function getValidAccessToken(userId: string): Promise<string> {
  const conn = await getGoogleConnectionByUserId(userId);
  if (!conn) throw new Error("not_connected");

  // If token expires in the next 60 s, refresh now
  const needsRefresh =
    conn.expiresAt && conn.expiresAt.getTime() - Date.now() < 60_000;

  if (!needsRefresh) return conn.accessToken;

  if (!conn.refreshToken) throw new Error("no_refresh_token");
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error("google_misconfigured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) throw new Error("token_refresh_failed");

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : undefined;

  await upsertGoogleConnection({
    userId,
    accessToken: data.access_token,
    expiresAt,
  });

  return data.access_token;
}

/** Wraps a Google API call with auth header. */
export async function googleFetch(
  userId: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getValidAccessToken(userId);
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
}
