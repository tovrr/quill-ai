import { DrizzleQueryError } from "drizzle-orm/errors";

/** The SQLSTATE error the neon driver throws, which Drizzle wraps in a DrizzleQueryError. */
export function postgresError(code: string, message: string): Error {
  return Object.assign(new Error(message), { name: "NeonDbError", code });
}

/**
 * What neon-http throws for a query on a database that lacks a column: a real
 * DrizzleQueryError (the SQL and its params, no code) whose cause carries 42703.
 */
export function missingColumnError(table = "autopilot_workflow", column = "mode"): DrizzleQueryError {
  return new DrizzleQueryError(
    `select "id", "${column}" from "${table}" "t" where "t"."id" = $1`,
    ["wf-1"],
    postgresError("42703", `column "${column}" does not exist`),
  );
}
