/**
 * A guard for the Autopilot routes when the database is behind the code.
 *
 * The cron and the Autopilot API select every column of `autopilot_workflow` and
 * `autopilot_run`, and nothing runs a migration for them: if a release that adds a column
 * is deployed before its SQL is applied, every Autopilot query fails with Postgres 42703
 * (undefined_column). This turns that failure into one clear, logged answer that names the
 * file to run, instead of an opaque 500.
 *
 * It works per request on purpose, not at boot: it needs no database at startup, and only
 * the Autopilot routes query these tables, so the rest of the app is not affected.
 */

import { NextResponse } from "next/server";
import { describeErrorForLog, isMissingAutopilotColumn } from "@/lib/autopilot/errors";

/**
 * The SQL that adds the newest Autopilot columns. When a release adds an Autopilot column,
 * point this at its SQL file (see the release checklist in DEPLOYMENT_CHECKLIST.md).
 */
export const AUTOPILOT_MIGRATION_FILE = "src/db/migrations/2026-11-02-autopilot-policy-observe.sql";

export const AUTOPILOT_SCHEMA_OUTDATED = "autopilot_schema_outdated";

/** The body of the 503, also what the page shows. */
export function autopilotSchemaOutdatedBody() {
  return {
    error:
      "Autopilot is unavailable: the database is missing columns this version needs. " +
      `The owner must run ${AUTOPILOT_MIGRATION_FILE} (or npm run db:push), then try again.`,
    code: AUTOPILOT_SCHEMA_OUTDATED,
    migration: AUTOPILOT_MIGRATION_FILE,
  };
}

/** One log line for a missing Autopilot column; the error name and SQLSTATE, never the message. */
export function logAutopilotSchemaOutdated(err: unknown, extra: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      event: "autopilot.schema.outdated",
      migration: AUTOPILOT_MIGRATION_FILE,
      ...extra,
      ...describeErrorForLog(err),
    }),
  );
}

/**
 * Runs a route handler. A missing Autopilot column comes back as a 503 that names the
 * migration file, and is logged once; any other error is thrown again unchanged.
 */
export async function guardAutopilotSchema(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (!isMissingAutopilotColumn(err)) throw err;
    logAutopilotSchemaOutdated(err);
    return NextResponse.json(autopilotSchemaOutdatedBody(), { status: 503 });
  }
}
