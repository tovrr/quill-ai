"use client";

import { createAuthClient as createBetterAuthClient } from "better-auth/client";
import { useEffect, useState } from "react";

type AuthClient = ReturnType<typeof createBetterAuthClient>;

let _client: AuthClient | null = null;

function getClient(): AuthClient {
  if (!_client) {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    _client = createBetterAuthClient({
      baseURL: `${origin}/api/auth`,
    });
  }
  return _client;
}

// Proxy so auth methods are available lazily
export const authClient = new Proxy({} as AuthClient, {
  get(_target, prop) {
    const client = getClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (client as any)[prop];
    if (typeof value === "function") return value.bind(client);
    return value;
  },
});
