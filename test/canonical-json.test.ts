import { describe, expect, it } from "vitest";
import { canonicalJson } from "@/lib/canonical-json";

describe("canonicalJson", () => {
  it("sorts the keys of every object, whatever the order they were written in", () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}');
    expect(canonicalJson({ a: { c: 3, d: 4 }, b: 1 })).toBe(canonicalJson({ b: 1, a: { d: 4, c: 3 } }));
  });

  it("keeps the order of an array and sorts the objects inside it", () => {
    expect(canonicalJson([{ b: 1, a: 2 }, 3, "x"])).toBe('[{"a":2,"b":1},3,"x"]');
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it("leaves out an undefined member, as JSON.stringify does", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it("writes null, undefined and the scalars the way JSON does", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(undefined)).toBe("null");
    expect(canonicalJson([undefined])).toBe("[null]");
    expect(canonicalJson("a\"b")).toBe('"a\\"b"');
    expect(canonicalJson(1.5)).toBe("1.5");
    expect(canonicalJson(false)).toBe("false");
  });

  it("agrees with JSON.stringify once the keys are in order", () => {
    const value = { a: [1, { b: "x", c: null }], d: { e: true } };
    expect(canonicalJson(value)).toBe(JSON.stringify(value));
  });
});
