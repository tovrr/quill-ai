import type { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuth = ReturnType<typeof createNeonAuth>;

let _auth: NeonAuth | null = null;
let _initError: string | null = null;

function getAuth(): NeonAuth {
  if (_initError) {
    throw new Error(_initError);
  }
  if (!_auth) {
    try {
      const baseUrl = process.env.NEON_AUTH_BASE_URL;
      if (!baseUrl) {
        _initError = "NEON_AUTH_BASE_URL must be set";
        throw new Error(_initError);
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@neondatabase/auth/next/server") as { createNeonAuth: typeof createNeonAuth };
      _auth = mod.createNeonAuth({ baseUrl } as Parameters<typeof createNeonAuth>[0]);
    } catch (e) {
      _initError = e instanceof Error ? e.message : "Auth init failed";
      throw e;
    }
  }
  return _auth;
}

export const auth = new Proxy({} as NeonAuth, {
  get(_target, prop) {
    const instance = getAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (instance as any)[prop];
    if (typeof value === "function") return value.bind(instance);
    return value;
  },
});
