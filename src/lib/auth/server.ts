import { createNeonAuth } from "@neondatabase/auth/next/server";

let _auth: ReturnType<typeof createNeonAuth> | null = null;

function getAuth() {
  if (!_auth) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    if (!baseUrl) {
      throw new Error("NEON_AUTH_BASE_URL must be set");
    }

    _auth = createNeonAuth({ baseUrl } as Parameters<typeof createNeonAuth>[0]);
  }
  return _auth;
}

// Proxy so auth.handler(), auth.getSession(), etc. work lazily
export const auth = new Proxy({} as ReturnType<typeof createNeonAuth>, {
  get(_target, prop) {
    const instance = getAuth();
    const value = Reflect.get(instance, prop);
    if (typeof value === "function") return value.bind(instance);
    return value;
  },
});
