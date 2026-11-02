/**
 * Error helpers for the Autopilot runner and cron route.
 */

// Wrapped errors nest a few levels at most (RetryError -> APICallError -> TimeoutError);
// the bound also protects against a `cause` cycle.
const MAX_CAUSE_DEPTH = 5;

const ABORT_ERROR_NAMES = new Set(["TimeoutError", "AbortError", "ResponseAborted"]);

/** The errors an error wraps: the standard `cause`, and the AI SDK's RetryError `lastError`. */
function wrappedErrors(err: unknown): unknown[] {
  if (typeof err !== "object" || err === null) return [];
  const { cause, lastError } = err as { cause?: unknown; lastError?: unknown };
  return [cause, lastError].filter((inner) => inner !== undefined && inner !== null);
}

/** Visits `err` and what it wraps, outermost first, at most MAX_CAUSE_DEPTH levels deep. */
function someInChain(err: unknown, predicate: (candidate: unknown) => boolean, depth = 0): boolean {
  if (predicate(err)) return true;
  if (depth >= MAX_CAUSE_DEPTH) return false;
  return wrappedErrors(err).some((inner) => someInChain(inner, predicate, depth + 1));
}

/**
 * True when the error, or an error it wraps, is a timeout or an abort. The AI SDK
 * can wrap the abort of `AbortSignal.timeout()` in its own error type, so checking
 * the outer `name` alone is not enough.
 */
export function isTimeoutOrAbort(err: unknown): boolean {
  return someInChain(
    err,
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      ABORT_ERROR_NAMES.has((candidate as { name?: unknown }).name as string),
  );
}

/**
 * What is safe to log about a failed database write: the error class and the
 * Postgres error code, never the message. A DrizzleQueryError message carries the
 * SQL parameters, which for an Autopilot write are the model's answer or the user's
 * prompt.
 */
export function describeErrorForLog(err: unknown): { errorName: string; errorCode?: string } {
  let errorCode: string | undefined;
  someInChain(err, (candidate) => {
    const code = typeof candidate === "object" && candidate !== null ? (candidate as { code?: unknown }).code : undefined;
    if (typeof code === "string" || typeof code === "number") errorCode = String(code);
    return errorCode !== undefined;
  });

  const errorName = err instanceof Error ? err.name : typeof err;
  return errorCode === undefined ? { errorName } : { errorName, errorCode };
}

// Built-in classes that report a bug in the code (`undefined.x`, a missing variable, a bad
// range). Their messages describe the code, not the data. SyntaxError is left out on
// purpose: `JSON.parse` echoes a piece of its input in the message.
const CODE_BUG_ERROR_NAMES = new Set(["TypeError", "ReferenceError", "RangeError"]);

const MAX_LOGGED_MESSAGE_LENGTH = 200;

/** A Postgres or Drizzle error carries an SQLSTATE `code`, or the failed query and its parameters. */
function looksLikeDatabaseError(candidate: unknown): boolean {
  if (typeof candidate !== "object" || candidate === null) return false;
  return ["code", "query", "params", "detail"].some((key) => key in candidate);
}

/**
 * describeErrorForLog, plus a short `errorMessage` when the failure is a bug in the code
 * and nothing in its chain looks like a database error. Anything else keeps the
 * name-and-code form, so a failed write cannot put the prompt or the model's answer in a
 * log. A Node error with a `code` (ERR_INVALID_ARG_TYPE) is left out too: its message
 * echoes the value it received.
 */
export function describeUnexpectedErrorForLog(err: unknown): {
  errorName: string;
  errorCode?: string;
  errorMessage?: string;
} {
  const described = describeErrorForLog(err);
  if (!(err instanceof Error) || !CODE_BUG_ERROR_NAMES.has(err.name) || someInChain(err, looksLikeDatabaseError)) {
    return described;
  }
  return { ...described, errorMessage: err.message.slice(0, MAX_LOGGED_MESSAGE_LENGTH) };
}
