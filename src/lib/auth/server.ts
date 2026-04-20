import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveBaseUrl(): string | undefined {
  const explicit = normalizeOrigin(process.env.BETTER_AUTH_URL);
  if (explicit) return explicit;

  const publicUrl = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (publicUrl) return publicUrl;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withProtocol = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return normalizeOrigin(withProtocol);
  }

  return undefined;
}

function resolveTrustedOrigins(baseURL: string | undefined): string[] | undefined {
  const configured = parseCsv(process.env.BETTER_AUTH_TRUSTED_ORIGINS)
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  const values = new Set<string>();

  if (baseURL) values.add(baseURL);

  const publicUrl = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (publicUrl) values.add(publicUrl);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withProtocol = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    const origin = normalizeOrigin(withProtocol);
    if (origin) values.add(origin);
  }

  for (const origin of configured) {
    values.add(origin);
  }

  return values.size > 0 ? [...values] : undefined;
}

const baseURL = resolveBaseUrl();
const trustedOrigins = resolveTrustedOrigins(baseURL);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins,
});
