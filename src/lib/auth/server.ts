import type { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuth = ReturnType<typeof createNeonAuth>;

let _auth: NeonAuth | undefined;

function getAuth(): NeonAuth {
  if (!_auth) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return {} as NeonAuth;
    }

    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    if (!baseUrl) {
      throw new Error("NEON_AUTH_BASE_URL must be set");
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@neondatabase/auth/next/server") as { createNeonAuth: typeof createNeonAuth };
    _auth = mod.createNeonAuth({ baseUrl } as Parameters<typeof createNeonAuth>[0]);
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
