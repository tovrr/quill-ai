"use client";

import { createAuthClient as createBetterAuthClient } from "better-auth/client";

export const authClient = createBetterAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin + "/api/auth" : "/api/auth",
});
