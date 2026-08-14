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

export type GithubInstallationInfoResult =
  | { ok: true; accountLogin: string; accountType: "User" | "Organization" }
  | { ok: false; error: string };

/**
 * Fetch installation metadata (account login/type) via GET
 * /app/installations/{id}, authenticated with the App JWT (not an
 * installation token -- this is an App-level endpoint). Verified against a
 * real installation 2026-08-14 (id=153732547, account=tovrr/User) while
 * testing this feature end-to-end from the VPS -- this is the same
 * follow-up call flagged as a TODO in the callback route when PR 1 shipped.
 */
export async function fetchInstallationInfo(installationId: string): Promise<GithubInstallationInfoResult> {
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
    const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      return { ok: false, error: `github_installation_lookup_failed_${res.status}` };
    }

    const data = (await res.json()) as { account: { login: string; type: "User" | "Organization" } };
    return { ok: true, accountLogin: data.account.login, accountType: data.account.type };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "github_installation_lookup_error" };
  }
}

export type GithubRepo = {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
};

export type GithubRepoListResult =
  | { ok: true; repos: GithubRepo[] }
  | { ok: false; error: string };

/**
 * List repositories accessible to an installation token, via GET
 * /installation/repositories. Distinct from fetchInstallationInfo() above:
 * this call is authenticated with the per-installation access token (not
 * the App JWT), matching GitHub's requirement for this endpoint.
 */
export async function fetchInstallationRepos(installationToken: string): Promise<GithubRepoListResult> {
  try {
    const res = await fetch("https://api.github.com/installation/repositories", {
      method: "GET",
      headers: {
        Authorization: `token ${installationToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      return { ok: false, error: `github_repo_list_failed_${res.status}` };
    }

    const data = (await res.json()) as {
      repositories: Array<{ id: number; full_name: string; private: boolean; default_branch: string }>;
    };

    return {
      ok: true,
      repos: data.repositories.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "github_repo_list_error" };
  }
}

// ─── Repo file pull (Track C.3 PR 3) ─────────────────────────────────────────
//
// Fetches a repo's file tree + blob contents via GitHub's Git Data API
// (recursive tree + individual blob fetches). Text files only -- binary
// blobs (images, fonts, etc.) are skipped since Canvas artifacts are
// source-file bundles, not asset bundles. Hard caps on file count and total
// size to keep this a quick synchronous pull rather than something that
// needs background job infrastructure we don't have.

const PULL_MAX_FILES = 200;
const PULL_MAX_TOTAL_BYTES = 2 * 1024 * 1024; // 2 MB
const PULL_MAX_FILE_BYTES = 256 * 1024; // 256 KB per file

// Paths/extensions that are almost always binary or noise we don't want in
// a Canvas artifact -- skipped without even attempting a blob fetch.
const PULL_SKIP_PATTERNS = [
  /^node_modules\//,
  /^\.git\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|pdf|zip|tar|gz|mp4|mov|mp3|wav|lock)$/i,
];

export type GithubPullResult =
  | { ok: true; files: Record<string, string>; skipped: string[]; truncated: boolean }
  | { ok: false; error: string };

/**
 * Pull a repo's text files into a flat { path: content } map, suitable for
 * FileBundleArtifact.payload.files (src/lib/builder/artifacts.ts). Uses the
 * Git Data API's recursive tree endpoint (one call to list everything) then
 * fetches blobs individually for files under the size/count caps.
 */
export async function pullRepoFiles(
  installationToken: string,
  repoFullName: string,
  branch: string,
): Promise<GithubPullResult> {
  const headers = {
    Authorization: `token ${installationToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    // 1. Resolve the branch to a commit SHA, then the commit to a tree SHA.
    const branchRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/branches/${encodeURIComponent(branch)}`,
      { headers },
    );
    if (!branchRes.ok) {
      return { ok: false, error: `github_branch_lookup_failed_${branchRes.status}` };
    }
    const branchData = (await branchRes.json()) as { commit: { commit: { tree: { sha: string } } } };
    const treeSha = branchData.commit.commit.tree.sha;

    // 2. Fetch the full recursive tree in one call.
    const treeRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees/${treeSha}?recursive=1`,
      { headers },
    );
    if (!treeRes.ok) {
      return { ok: false, error: `github_tree_fetch_failed_${treeRes.status}` };
    }
    const treeData = (await treeRes.json()) as {
      tree: Array<{ path: string; type: string; sha: string; size?: number }>;
      truncated?: boolean;
    };

    const blobs = treeData.tree.filter((entry) => entry.type === "blob");

    const files: Record<string, string> = {};
    const skipped: string[] = [];
    let totalBytes = 0;

    for (const entry of blobs) {
      if (Object.keys(files).length >= PULL_MAX_FILES) {
        skipped.push(entry.path);
        continue;
      }
      if (PULL_SKIP_PATTERNS.some((pattern) => pattern.test(entry.path))) {
        skipped.push(entry.path);
        continue;
      }
      if (entry.size !== undefined && entry.size > PULL_MAX_FILE_BYTES) {
        skipped.push(entry.path);
        continue;
      }
      if (totalBytes + (entry.size ?? 0) > PULL_MAX_TOTAL_BYTES) {
        skipped.push(entry.path);
        continue;
      }

      const blobRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/blobs/${entry.sha}`, {
        headers,
      });
      if (!blobRes.ok) {
        skipped.push(entry.path);
        continue;
      }
      const blobData = (await blobRes.json()) as { content: string; encoding: string; size: number };

      if (blobData.encoding !== "base64") {
        skipped.push(entry.path);
        continue;
      }

      let decoded: string;
      try {
        decoded = Buffer.from(blobData.content, "base64").toString("utf8");
      } catch {
        skipped.push(entry.path);
        continue;
      }

      // Heuristic binary detection: a null byte anywhere means this almost
      // certainly isn't a text file GitHub's API just handed us as base64
      // without the earlier extension-based skip catching it.
      if (decoded.includes("\u0000")) {
        skipped.push(entry.path);
        continue;
      }

      files[entry.path] = decoded;
      totalBytes += blobData.size;
    }

    return { ok: true, files, skipped, truncated: Boolean(treeData.truncated) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "github_pull_error" };
  }
}
