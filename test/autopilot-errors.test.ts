import { describe, expect, it } from "vitest";
import {
  describeErrorForLog,
  describeUnexpectedErrorForLog,
  isMissingAutopilotColumn,
  isTimeoutOrAbort,
} from "@/lib/autopilot/errors";
import { missingColumnError, postgresError } from "./helpers/db-errors";

const LEAK = "the user's prompt, or the model's answer";

function named(name: string, message = "boom"): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

function withCode(code: unknown, message = "db failure"): Error {
  return Object.assign(new Error(message), { code });
}

/** `depth` wrappers around `leaf`: the leaf sits `depth` levels below the outermost error. */
function wrap(leaf: Error, depth: number, link: "cause" | "lastError" = "cause"): Error {
  let current = leaf;
  for (let level = 0; level < depth; level++) {
    current = Object.assign(new Error(`wrapper ${level}`), { [link]: current });
  }
  return current;
}

function selfReferencing(link: "cause" | "lastError"): Error {
  const err = new Error("loop");
  Object.assign(err, { [link]: err });
  return err;
}

describe("isTimeoutOrAbort", () => {
  it.each(["TimeoutError", "AbortError", "ResponseAborted"])("recognises a %s", (name) => {
    expect(isTimeoutOrAbort(named(name))).toBe(true);
  });

  it("recognises a DOMException timeout, which is not an Error subclass", () => {
    expect(isTimeoutOrAbort(new DOMException("timed out", "TimeoutError"))).toBe(true);
  });

  it("recognises a timeout wrapped as a cause", () => {
    expect(isTimeoutOrAbort(wrap(named("TimeoutError"), 1))).toBe(true);
  });

  it("recognises a timeout under a RetryError's lastError", () => {
    expect(isTimeoutOrAbort(wrap(named("TimeoutError"), 1, "lastError"))).toBe(true);
  });

  it("does not take another error for a timeout", () => {
    expect(isTimeoutOrAbort(new Error("TimeoutError"))).toBe(false);
    expect(isTimeoutOrAbort(wrap(new Error("plain"), 2))).toBe(false);
  });

  it("looks at most 5 levels down", () => {
    expect(isTimeoutOrAbort(wrap(named("TimeoutError"), 5))).toBe(true);
    expect(isTimeoutOrAbort(wrap(named("TimeoutError"), 6))).toBe(false);
  });

  it("stops on an error that wraps itself", () => {
    expect(isTimeoutOrAbort(selfReferencing("cause"))).toBe(false);
    expect(isTimeoutOrAbort(selfReferencing("lastError"))).toBe(false);
  });

  it.each([null, undefined, "TimeoutError", 42])("is false for the non-error %j", (value) => {
    expect(isTimeoutOrAbort(value)).toBe(false);
  });
});

describe("describeErrorForLog", () => {
  it("gives the class name, and the code when there is one", () => {
    expect(describeErrorForLog(new TypeError("x"))).toEqual({ errorName: "TypeError" });
    expect(describeErrorForLog(withCode("57P01"))).toEqual({ errorName: "Error", errorCode: "57P01" });
  });

  it("turns a numeric code into a string", () => {
    expect(describeErrorForLog(withCode(23505))).toEqual({ errorName: "Error", errorCode: "23505" });
  });

  it("ignores a code that is neither a string nor a number", () => {
    expect(describeErrorForLog(withCode(true))).toEqual({ errorName: "Error" });
    expect(describeErrorForLog(withCode({ nested: "57P01" }))).toEqual({ errorName: "Error" });
  });

  it("finds the code of a wrapped error, through cause and through lastError", () => {
    expect(describeErrorForLog(wrap(withCode("57P01"), 2))).toEqual({ errorName: "Error", errorCode: "57P01" });
    expect(describeErrorForLog(wrap(withCode("57P01"), 2, "lastError"))).toEqual({
      errorName: "Error",
      errorCode: "57P01",
    });
  });

  it("prefers the code of the outermost error", () => {
    const outer = Object.assign(withCode("OUTER"), { cause: withCode("INNER") });
    expect(describeErrorForLog(outer)).toEqual({ errorName: "Error", errorCode: "OUTER" });
  });

  it("looks for a code at most 5 levels down", () => {
    expect(describeErrorForLog(wrap(withCode("57P01"), 5))).toEqual({ errorName: "Error", errorCode: "57P01" });
    expect(describeErrorForLog(wrap(withCode("57P01"), 6))).toEqual({ errorName: "Error" });
  });

  it("stops on an error that wraps itself", () => {
    expect(describeErrorForLog(selfReferencing("cause"))).toEqual({ errorName: "Error" });
    expect(describeErrorForLog(selfReferencing("lastError"))).toEqual({ errorName: "Error" });
  });

  it("names the type of a value that is not an Error", () => {
    expect(describeErrorForLog("failed")).toEqual({ errorName: "string" });
    expect(describeErrorForLog(null)).toEqual({ errorName: "object" });
    expect(describeErrorForLog(undefined)).toEqual({ errorName: "undefined" });
    expect(describeErrorForLog(7)).toEqual({ errorName: "number" });
    expect(describeErrorForLog({ code: "ECONNRESET" })).toEqual({ errorName: "object", errorCode: "ECONNRESET" });
  });

  it("never carries the message", () => {
    const drizzle = Object.assign(named("DrizzleQueryError", `Failed query: insert ...\nparams: ${LEAK}`), {
      cause: withCode("57P01", LEAK),
    });
    const described = describeErrorForLog(drizzle);
    expect(described).toEqual({ errorName: "DrizzleQueryError", errorCode: "57P01" });
    expect(JSON.stringify(described)).not.toContain(LEAK);
    expect(describeErrorForLog(LEAK)).toEqual({ errorName: "string" });
  });
});

describe("describeUnexpectedErrorForLog", () => {
  it.each([TypeError, ReferenceError, RangeError])("adds the message of a %o", (ErrorClass) => {
    const err = new ErrorClass("Cannot read properties of undefined (reading 'id')");
    expect(describeUnexpectedErrorForLog(err)).toEqual({
      errorName: err.name,
      errorMessage: "Cannot read properties of undefined (reading 'id')",
    });
  });

  it("cuts a long message at 200 characters", () => {
    const described = describeUnexpectedErrorForLog(new TypeError("x".repeat(500)));
    expect(described.errorMessage).toBe("x".repeat(200));
  });

  it("keeps the message of a SyntaxError out: JSON.parse echoes its input", () => {
    let thrown: unknown;
    try {
      JSON.parse(`{"answer": "${LEAK}`);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(SyntaxError);
    expect(describeUnexpectedErrorForLog(thrown)).toEqual({ errorName: "SyntaxError" });
  });

  it("keeps the message of a plain Error out", () => {
    expect(describeUnexpectedErrorForLog(new Error(LEAK))).toEqual({ errorName: "Error" });
  });

  it("keeps the message of a database error out, whatever its class", () => {
    const drizzle = named("DrizzleQueryError", `Failed query: insert ...\nparams: ${LEAK}`);
    expect(describeUnexpectedErrorForLog(drizzle)).toEqual({ errorName: "DrizzleQueryError" });

    for (const dbFields of [{ code: "23505" }, { query: "insert ..." }, { params: [LEAK] }, { detail: LEAK }]) {
      const described = describeUnexpectedErrorForLog(Object.assign(new TypeError(LEAK), dbFields));
      expect(described, JSON.stringify(Object.keys(dbFields))).not.toHaveProperty("errorMessage");
      expect(JSON.stringify(described)).not.toContain(LEAK);
    }
  });

  it("keeps the message out when the error wraps a database error", () => {
    const wrapped = Object.assign(new TypeError(LEAK), { cause: withCode("57P01") });
    expect(describeUnexpectedErrorForLog(wrapped)).toEqual({ errorName: "TypeError", errorCode: "57P01" });
    expect(describeUnexpectedErrorForLog(wrap(Object.assign(new Error("db"), { params: [LEAK] }), 1))).toEqual({
      errorName: "Error",
    });
  });

  it("does not look for a database error more than 5 levels down", () => {
    const deep = Object.assign(new TypeError("code bug"), { cause: wrap(withCode("57P01"), 5) });
    expect(describeUnexpectedErrorForLog(deep)).toEqual({ errorName: "TypeError", errorMessage: "code bug" });
  });

  it("stops on an error that wraps itself", () => {
    const err = new TypeError("loop");
    Object.assign(err, { cause: err });
    expect(describeUnexpectedErrorForLog(err)).toEqual({ errorName: "TypeError", errorMessage: "loop" });
  });

  it("names the type of a value that is not an Error", () => {
    expect(describeUnexpectedErrorForLog(LEAK)).toEqual({ errorName: "string" });
    expect(describeUnexpectedErrorForLog(null)).toEqual({ errorName: "object" });
  });
});

describe("isMissingAutopilotColumn", () => {
  it("recognises the error neon-http gives: a DrizzleQueryError whose cause carries 42703", () => {
    expect(isMissingAutopilotColumn(missingColumnError("autopilot_workflow", "policyHash"))).toBe(true);
    expect(isMissingAutopilotColumn(missingColumnError("autopilot_run", "toolCalls"))).toBe(true);
  });

  it("recognises a bare driver error, which carries no SQL to check", () => {
    expect(isMissingAutopilotColumn(postgresError("42703", 'column "mode" does not exist'))).toBe(true);
  });

  it("finds the code deeper in the chain, and under a lastError", () => {
    expect(isMissingAutopilotColumn(wrap(postgresError("42703", "x"), 3))).toBe(true);
    expect(isMissingAutopilotColumn(wrap(postgresError("42703", "x"), 1, "lastError"))).toBe(true);
  });

  it("reads a numeric code too", () => {
    expect(isMissingAutopilotColumn(withCode(42703))).toBe(true);
  });

  it("does not take another SQLSTATE for a missing column", () => {
    for (const code of ["42P01", "23505", "57P01", "42704", ""]) {
      expect(isMissingAutopilotColumn(postgresError(code, "other"))).toBe(false);
    }
  });

  it("does not take a missing column of another table for this migration's", () => {
    expect(isMissingAutopilotColumn(missingColumnError("chat", "title"))).toBe(false);
    expect(isMissingAutopilotColumn(missingColumnError("autopilot_workflow_archive", "title"))).toBe(false);
  });

  it("does not take a plain error, a timeout, or a value that is not an error for one", () => {
    expect(isMissingAutopilotColumn(new Error("42703"))).toBe(false);
    expect(isMissingAutopilotColumn(named("TimeoutError"))).toBe(false);
    expect(isMissingAutopilotColumn(undefined)).toBe(false);
    expect(isMissingAutopilotColumn(null)).toBe(false);
    expect(isMissingAutopilotColumn("42703")).toBe(false);
  });

  it("stops on an error that wraps itself", () => {
    expect(isMissingAutopilotColumn(selfReferencing("cause"))).toBe(false);
    expect(isMissingAutopilotColumn(selfReferencing("lastError"))).toBe(false);
  });
});
