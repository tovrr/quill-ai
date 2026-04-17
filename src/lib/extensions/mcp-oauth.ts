import { decryptSecret, encryptSecret } from "@/lib/auth/secret-box";

export type McpOAuthConfig = {
  oauthAuthorizeUrl: string | null;
  oauthTokenUrl: string | null;
  oauthClientId: string | null;
  oauthClientSecretEnc: string | null;
  oauthScopes: string | null;
  oauthRedirectUri: string | null;
};

export function isMcpOAuthConfigured(config: McpOAuthConfig): boolean {
  return Boolean(
    config.oauthAuthorizeUrl &&
      config.oauthTokenUrl &&
      config.oauthClientId &&
      config.oauthClientSecretEnc &&
      config.oauthRedirectUri
  );
}

export function buildMcpOAuthAuthorizationUrl(config: McpOAuthConfig, state: string): string {
  if (!config.oauthAuthorizeUrl || !config.oauthClientId || !config.oauthRedirectUri) {
    throw new Error("mcp_oauth_not_configured");
  }

  const url = new URL(config.oauthAuthorizeUrl);
  url.searchParams.set("client_id", config.oauthClientId);
  url.searchParams.set("redirect_uri", config.oauthRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  if (config.oauthScopes) {
    url.searchParams.set("scope", config.oauthScopes);
  }

  if (!url.searchParams.has("access_type")) {
    url.searchParams.set("access_type", "offline");
  }

  return url.toString();
}

export async function exchangeMcpOAuthCode(args: {
  config: McpOAuthConfig;
  code: string;
}): Promise<{
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  expiresAt: Date | null;
}> {
  const { config, code } = args;

  if (!config.oauthTokenUrl || !config.oauthClientId || !config.oauthClientSecretEnc || !config.oauthRedirectUri) {
    throw new Error("mcp_oauth_not_configured");
  }

  const clientSecret = decryptSecret(config.oauthClientSecretEnc);

  const tokenResponse = await fetch(config.oauthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.oauthClientId,
      client_secret: clientSecret,
      redirect_uri: config.oauthRedirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`mcp_oauth_token_exchange_failed_${tokenResponse.status}`);
  }

  const payload = (await tokenResponse.json()) as Record<string, unknown>;
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : null;
  const expiresInSeconds =
    typeof payload.expires_in === "number"
      ? payload.expires_in
      : typeof payload.expires_in === "string"
        ? Number(payload.expires_in)
        : null;

  if (!accessToken) {
    throw new Error("mcp_oauth_missing_access_token");
  }

  const expiresAt =
    typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds)
      ? new Date(Date.now() + expiresInSeconds * 1000)
      : null;

  return {
    accessTokenEnc: encryptSecret(accessToken),
    refreshTokenEnc: refreshToken ? encryptSecret(refreshToken) : null,
    expiresAt,
  };
}

export function resolveMcpBearerToken(server: {
  authToken: string | null;
  oauthAccessTokenEnc: string | null;
}): string | null {
  if (server.authToken) return server.authToken;
  if (server.oauthAccessTokenEnc) {
    return decryptSecret(server.oauthAccessTokenEnc);
  }
  return null;
}
