/**
 * GitHub App authentication helpers (Track C.3 -- safe skeleton, ROADMAP.md).
 *
 * Mirrors the shape already used for Hermes (src/lib/chat/model-selection.ts)
 * and OpenClaw (src/lib/execution/service.ts): double/triple-gated, fully
 * inert unless the real credentials are configured. Confirmed with the user
 * 2026-08-14 ("ok onayliyorum") that this should ship as infrastructure
 * ahead of the user actually registering a GitHub App.
 *
 * GitHub App auth is a two-step flow, distinct from a plain OAuth App:
 *   1. Sign a short-lived JWT with the App's private key (RS256, node:crypto
 *      -- no new dependency, matches the existing secret-box.ts style of
 *      using node:crypto directly rather than pulling in a JWT library).
 *   2. Exchange that JWT for a per-installation access token via GitHub's
 *      REST API (POST /app/installations/{id}/access_tokens). That token is
 *      what's actually stored (encrypted) in githubConnections.accessTokenEnc
 *      and used for repo reads/writes.
 *
 * None of this can be exercised end-to-end without a real GitHub App -- see
 * isGithubAppConfigured() below, which every caller must check first.
 */

import { createPrivateKey, createSign } from "node:crypto";

const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? "";
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY ?? "";
const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG ?? "";

/**
 * Whether a real GitHub App is configured. Every route/helper in this
 * feature must gate on this before doing anything -- with any of the three
 * env vars unset (today's default), GitHub publish/pull features must be
 * fully inert, matching the Hermes/OpenClaw/Apex skeleton pattern.
 */
export function isGithubAppConfigured(): boolean {
  return Boolean(GITHUB_APP_ID && GITHUB_APP_PRIVATE_KEY && GITHUB_APP_SLUG);
}

/** Public GitHub App installation URL, e.g. for a "Connect GitHub" button. */
export function getGithubAppInstallUrl(state: string): string {
  const params = new URLSearchParams({ state });
  return `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?${params.toString()}`;
}

/**
 * Sign a GitHub App JWT (RS256, 9-minute expiry per GitHub's 10-minute max).
 * Throws if GITHUB_APP_PRIVATE_KEY is not a valid PEM private key -- callers
 * must check isGithubAppConfigured() first and treat any throw here as a
 * hard configuration error, not a user-facing failure.
 */
function signAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60, // allow for clock drift
    exp: now + 9 * 60,
    iss: GITHUB_APP_ID,
  };

  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${encode(header)}.${encode(payload)}`;

  const privateKey = createPrivateKey(GITHUB_APP_PRIVATE_KEY);
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey).toString("base64url");

  return `${signingInput}.${signature}`;
}

export type GithubInstallationTokenResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Exchange the App JWT for a per-installation access token. This is the
 * token actually used for repo API calls (read/write, scoped to whatever
 * repos the user granted the App access to during installation).
 */
export async function fetchInstallationAccessToken(installationId: string): Promise<GithubInstallationTokenResult> {
  if (!isGithubAppConfigured()) {
    return { ok: false, error: "github_app_not_configured" };
  }

  let jwt: string;
  try {
    jwt = signAppJwt();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "jwt_sign_failed" };
  }

  try {
    const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      return { ok: false, error: `github_token_exchange_failed_${res.status}` };
    }

    const data = (await res.json()) as { token: string; expires_at: string };
    return { ok: true, token: data.token, expiresAt: new Date(data.expires_at) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "github_token_exchange_error" };
  }
}
