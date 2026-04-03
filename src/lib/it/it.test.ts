import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addUsedTokensToCurrentTest,
  clearFailedTests,
  getDescribePath,
  getFailedTestCount,
  getItPath,
  hasDescribeContext,
  hasItContext,
  resetDescribeContext,
  resetItContext,
  setCurrentTestModel,
  settlePendingTests,
} from "../context/context.js";
import { describe as describeFn } from "../describe/describe.js";
import { stripAnsi } from "../output/stripAnsi.js";
import { it as itFn, resetTestLoggingState } from "./it.js";

describe("it", () => {
  afterEach(async () => {
    resetDescribeContext();
    resetItContext();
    clearFailedTests();
    resetTestLoggingState();
    await settlePendingTests();
    vi.restoreAllMocks();
  });

  it("tracks it context for the callback and clears it after", () => {
    let observedPath = "";

    itFn("does something", () => {
      observedPath = getItPath();
      expect(hasItContext()).toBe(true);
    });

    expect(observedPath).toBe("does something");
    expect(hasItContext()).toBe(false);
  });

  it("tracks describe context when nested", () => {
    let observedDescribe = "";
    let observedIt = "";

    describeFn("suite name", () => {
      itFn("does something", () => {
        observedDescribe = getDescribePath();
        observedIt = getItPath();
        expect(hasDescribeContext()).toBe(true);
        expect(hasItContext()).toBe(true);
      });
    });

    expect(observedDescribe).toBe("suite name");
    expect(observedIt).toBe("does something");
    expect(hasDescribeContext()).toBe(false);
    expect(hasItContext()).toBe(false);
  });

  it("logs duration output for a passing test", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    describeFn("suite", () => {
      itFn("case", () => {});
    });

    const strippedLogCalls = logSpy.mock.calls
      .map(([value]) => (typeof value === "string" ? stripAnsi(value) : null))
      .filter((value): value is string => value !== null);
    expect(strippedLogCalls).toContain('Suite "suite"');
    expect(
      strippedLogCalls.some((value) =>
        /^Test "case"\n- Finished in \d+ ms\n---$/.test(value),
      ),
    ).toBe(true);
  });

  it("logs duration output for a failing test", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(() => {
      describeFn("suite", () => {
        itFn("case", () => {
          throw new Error("boom");
        });
      });
    }).toThrowError("boom");

    const strippedLogCalls = logSpy.mock.calls
      .map(([value]) => (typeof value === "string" ? stripAnsi(value) : null))
      .filter((value): value is string => value !== null);
    expect(strippedLogCalls).toContain('Suite "suite"');
    expect(
      strippedLogCalls.some((value) =>
        /^Test "case"\n- Finished in \d+ ms\n---$/.test(value),
      ),
    ).toBe(true);
  });

  it("logs duration output for an async passing test", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    describeFn("suite", () => {
      itFn("case", async () => {
        await Promise.resolve();
      });
    });

    const settled = await settlePendingTests();
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    const strippedLogCalls = logSpy.mock.calls
      .map(([value]) => (typeof value === "string" ? stripAnsi(value) : null))
      .filter((value): value is string => value !== null);
    expect(
      strippedLogCalls.some((value) =>
        /^Test "case"\n- Finished in \d+ ms\n---$/.test(value),
      ),
    ).toBe(true);
    expect(hasItContext()).toBe(false);
  });

  it("logs duration output for an async failing test", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    describeFn("suite", () => {
      itFn("case", async () => {
        throw new Error("async boom");
      });
    });

    const settled = await settlePendingTests();
    expect(settled).toHaveLength(1);
    expect(settled[0]?.status).toBe("rejected");
    const strippedLogCalls = logSpy.mock.calls
      .map(([value]) => (typeof value === "string" ? stripAnsi(value) : null))
      .filter((value): value is string => value !== null);
    expect(
      strippedLogCalls.some((value) =>
        /^Test "case"\n- Finished in \d+ ms\n---$/.test(value),
      ),
    ).toBe(true);
    expect(getFailedTestCount()).toBe(0);
    expect(hasItContext()).toBe(false);
  });

  it("prints suite heading once for multiple tests in same suite", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    describeFn("suite", () => {
      itFn("case one", () => {});
      itFn("case two", () => {});
    });

    const strippedLogCalls = logSpy.mock.calls
      .map(([value]) => (typeof value === "string" ? stripAnsi(value) : null))
      .filter((value): value is string => value !== null);
    expect(
      strippedLogCalls.filter((value) => /^Suite "suite"$/.test(value)),
    ).toHaveLength(1);
  });

  it("includes model and token usage lines when available", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    describeFn("suite", () => {
      itFn("case", () => {
        setCurrentTestModel("gpt-4o");
        addUsedTokensToCurrentTest(123);
      });
    });

    const strippedLogCalls = logSpy.mock.calls
      .map(([value]) => (typeof value === "string" ? stripAnsi(value) : null))
      .filter((value): value is string => value !== null);
    expect(
      strippedLogCalls.some((value) =>
        /^Test "case"\n- Finished in \d+ ms\n- Model gpt-4o\n- Tokens used 123\n---$/.test(
          value,
        ),
      ),
    ).toBe(true);
  });
});
