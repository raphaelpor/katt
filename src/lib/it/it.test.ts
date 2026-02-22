import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addUsedTokensToCurrentTest,
  clearFailedTests,
  getDescribePath,
  getFailedTestCount,
  getItPath,
  hasDescribeContext,
  hasItContext,
  registerFailedTest,
  resetDescribeContext,
  resetItContext,
  setCurrentTestModel,
  settlePendingTests,
} from "../context/context.js";
import { describe as describeFn } from "../describe/describe.js";
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

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Suite "\u001B\[1;36msuite\u001B\[0m"$/),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mcase\u001B\[0m"\n- ✅ Passed in \u001B\[1;36m\d+ms\u001B\[0m\n---$/,
      ),
    );
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

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Suite "\u001B\[1;36msuite\u001B\[0m"$/),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mcase\u001B\[0m"\n- ❌ Failed in \u001B\[1;36m\d+ms\u001B\[0m\n---$/,
      ),
    );
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
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mcase\u001B\[0m"\n- ✅ Passed in \u001B\[1;36m\d+ms\u001B\[0m\n---$/,
      ),
    );
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
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mcase\u001B\[0m"\n- ❌ Failed in \u001B\[1;36m\d+ms\u001B\[0m\n---$/,
      ),
    );
    expect(getFailedTestCount()).toBe(0);
    expect(hasItContext()).toBe(false);
  });

  it("logs failed output when an async test registers assertion failures", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    describeFn("suite", () => {
      itFn("case", async () => {
        await Promise.resolve();
        registerFailedTest({
          describePath: "suite",
          itPath: "case",
          message: "expected 'value' to include 'missing'",
        });
      });
    });

    const settled = await settlePendingTests();
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mcase\u001B\[0m"\n- ❌ Failed in \u001B\[1;36m\d+ms\u001B\[0m\n---$/,
      ),
    );
    expect(getFailedTestCount()).toBe(1);
    expect(hasItContext()).toBe(false);
  });

  it("prints suite heading once for multiple tests in same suite", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    describeFn("suite", () => {
      itFn("case one", () => {});
      itFn("case two", () => {});
    });

    expect(
      logSpy.mock.calls.filter(
        ([value]) =>
          typeof value === "string" &&
          /^Suite "\u001B\[1;36msuite\u001B\[0m"$/.test(value),
      ),
    ).toHaveLength(1);
  });

  it("prints suite heading once even when the same suite runs later again", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    describeFn("suite", () => {
      itFn("first", () => {});
    });
    describeFn("other suite", () => {
      itFn("middle", () => {});
    });
    describeFn("suite", () => {
      itFn("last", () => {});
    });

    expect(
      logSpy.mock.calls.filter(
        ([value]) =>
          typeof value === "string" &&
          /^Suite "\u001B\[1;36msuite\u001B\[0m"$/.test(value),
      ),
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

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mcase\u001B\[0m"\n- ✅ Passed in \u001B\[1;36m\d+ms\u001B\[0m\n- Model \u001B\[1;36mgpt-4o\u001B\[0m\n- Tokens used \u001B\[1;36m123\u001B\[0m\n---$/,
      ),
    );
  });
});
