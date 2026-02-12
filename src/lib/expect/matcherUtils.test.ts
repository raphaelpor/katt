import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearFailedTests,
  getFailedTests,
  resetDescribeContext,
  resetItContext,
} from "../context/context.js";
import { registerFailure } from "./matcherUtils.js";

describe("matcherUtils", () => {
  afterEach(() => {
    resetDescribeContext();
    resetItContext();
    clearFailedTests();
    vi.restoreAllMocks();
  });

  it("registers matcher failures without direct console output", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    registerFailure("expected 'a' to include 'missing'");

    expect(getFailedTests()).toEqual([
      {
        describePath: "",
        itPath: "",
        message: "expected 'a' to include 'missing'",
      },
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
