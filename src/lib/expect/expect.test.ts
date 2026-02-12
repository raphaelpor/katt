import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearFailedTests,
  getFailedTests,
  pushDescribe,
  pushIt,
  resetDescribeContext,
  resetItContext,
  settlePendingTests,
} from "../context/context.js";
import { prompt } from "../prompt/prompt.js";
import { expect as expectFn } from "./expect.js";

vi.mock("../prompt/prompt.js", () => ({
  prompt: vi.fn(),
}));

describe("expect", () => {
  afterEach(async () => {
    resetDescribeContext();
    resetItContext();
    clearFailedTests();
    await settlePendingTests();
    vi.clearAllMocks();
  });

  it("returns a matcher with toContain", () => {
    const matcher = expectFn("value");
    expect(matcher).toHaveProperty("toContain");
  });

  it("returns a matcher with toMatchSnapshot", () => {
    const matcher = expectFn("value");
    expect(matcher).toHaveProperty("toMatchSnapshot");
  });

  it("calls prompt with the provided input", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("Yes");

    await expectFn("value").promptCheck("Hello");

    expect(promptMock).toHaveBeenCalledTimes(1);
    const promptArg = promptMock.mock.calls[0]?.[0] ?? "";
    expect(promptArg).toContain('Expectation: "Hello"');
    expect(promptArg).toContain("value");
  });

  it("returns a matcher with toBeClassifiedAs", () => {
    const matcher = expectFn("value");
    expect(matcher).toHaveProperty("toBeClassifiedAs");
  });

  it("calls classifier prompt with classification and model", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("5");

    await expectFn("value").toBeClassifiedAs("helpful", { model: "gpt-5.2" });
    await settlePendingTests();

    expect(promptMock).toHaveBeenCalledTimes(1);
    const promptArg = promptMock.mock.calls[0]?.[0] ?? "";
    const optionsArg = promptMock.mock.calls[0]?.[1];
    expect(promptArg).toContain('"helpful"');
    expect(promptArg).toContain("value");
    expect(optionsArg).toEqual({ model: "gpt-5.2" });
  });

  it("does not log when the value contains the expected string", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    expectFn("value").toContain("val");

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("registers a failure when the value does not contain the expected string", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expectFn("value").toContain("missing");

    expect(errorSpy).not.toHaveBeenCalled();
    expect(getFailedTests()).toEqual([
      {
        describePath: "",
        itPath: "",
        message: "expected 'value' to include 'missing'",
      },
    ]);
    errorSpy.mockRestore();
  });

  it("registers describe and it context on failure when available", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    pushDescribe("suite");
    pushIt("case");

    expectFn("value").toContain("missing");

    expect(getFailedTests()).toEqual([
      {
        describePath: "suite",
        itPath: "case",
        message: "expected 'value' to include 'missing'",
      },
    ]);
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
