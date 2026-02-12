import { beforeEach, describe, expect, it } from "vitest";

import {
  addUsedTokensToCurrentTest,
  clearFailedTests,
  getCurrentTestModel,
  getFailedTests,
  getDescribePath,
  getCurrentTestTokenUsage,
  getItPath,
  hasDescribeContext,
  hasItContext,
  popDescribe,
  popIt,
  pushDescribe,
  pushIt,
  registerFailedTest,
  registerPendingTest,
  resetDescribeContext,
  resetItContext,
  setCurrentTestModel,
  settlePendingTests,
} from "./context.js";

describe("context", () => {
  beforeEach(() => {
    resetDescribeContext();
    resetItContext();
    clearFailedTests();
  });

  it("tracks describe context with push/pop", () => {
    expect(hasDescribeContext()).toBe(false);
    expect(getDescribePath()).toBe("");

    pushDescribe("suite");
    pushDescribe("nested");

    expect(hasDescribeContext()).toBe(true);
    expect(getDescribePath()).toBe("suite > nested");

    popDescribe();

    expect(getDescribePath()).toBe("suite");
    expect(hasDescribeContext()).toBe(true);

    popDescribe();

    expect(getDescribePath()).toBe("");
    expect(hasDescribeContext()).toBe(false);
  });

  it("tracks it context with push/pop", () => {
    expect(hasItContext()).toBe(false);
    expect(getItPath()).toBe("");

    pushIt("case");
    pushIt("nested");

    expect(hasItContext()).toBe(true);
    expect(getItPath()).toBe("case > nested");

    popIt();

    expect(getItPath()).toBe("case");
    expect(hasItContext()).toBe(true);

    popIt();

    expect(getItPath()).toBe("");
    expect(hasItContext()).toBe(false);
  });

  it("handles popping empty stacks without throwing", () => {
    expect(() => popDescribe()).not.toThrow();
    expect(() => popIt()).not.toThrow();
    expect(getDescribePath()).toBe("");
    expect(getItPath()).toBe("");
  });

  it("reset helpers clear stacks", () => {
    pushDescribe("suite");
    pushIt("case");

    resetDescribeContext();
    resetItContext();

    expect(hasDescribeContext()).toBe(false);
    expect(hasItContext()).toBe(false);
    expect(getDescribePath()).toBe("");
    expect(getItPath()).toBe("");
  });

  it("settles tests added while settling existing tests", async () => {
    registerPendingTest(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          registerPendingTest(Promise.resolve());
          resolve();
        }, 0);
      }),
    );

    const settled = await settlePendingTests();

    expect(settled).toHaveLength(2);
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
  });

  it("tracks failed tests and can clear them", () => {
    registerFailedTest({
      describePath: "suite",
      itPath: "case",
      message: "expected 'a' to include 'b'",
    });

    expect(getFailedTests()).toEqual([
      {
        describePath: "suite",
        itPath: "case",
        message: "expected 'a' to include 'b'",
      },
    ]);

    clearFailedTests();

    expect(getFailedTests()).toEqual([]);
  });

  it("tracks token usage for the active test context", () => {
    pushIt("case");
    expect(getCurrentTestTokenUsage()).toBe(0);

    addUsedTokensToCurrentTest(42);
    addUsedTokensToCurrentTest(8);

    expect(getCurrentTestTokenUsage()).toBe(50);

    popIt();
    expect(getCurrentTestTokenUsage()).toBe(0);
  });

  it("ignores invalid token usage values and missing it context", () => {
    addUsedTokensToCurrentTest(10);
    expect(getCurrentTestTokenUsage()).toBe(0);

    pushIt("case");
    addUsedTokensToCurrentTest(Number.NaN);
    addUsedTokensToCurrentTest(-5);
    addUsedTokensToCurrentTest(0);
    expect(getCurrentTestTokenUsage()).toBe(0);
  });

  it("tracks model usage for the active test context", () => {
    pushIt("case");
    expect(getCurrentTestModel()).toBeUndefined();

    setCurrentTestModel("gpt-5.2");

    expect(getCurrentTestModel()).toBe("gpt-5.2");

    popIt();
    expect(getCurrentTestModel()).toBeUndefined();
  });

  it("ignores empty model values and missing it context", () => {
    setCurrentTestModel("gpt-4o");
    expect(getCurrentTestModel()).toBeUndefined();

    pushIt("case");
    setCurrentTestModel("");

    expect(getCurrentTestModel()).toBeUndefined();
  });
});
