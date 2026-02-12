import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearFailedTests,
  getFailedTests,
  resetDescribeContext,
  resetItContext,
  settlePendingTests,
} from "../context/context.js";
import { prompt } from "../prompt/prompt.js";
import { promptCheck } from "./promptCheck.js";

vi.mock("../prompt/prompt.js", () => ({
  prompt: vi.fn(),
}));

describe("promptCheck", () => {
  afterEach(async () => {
    resetDescribeContext();
    resetItContext();
    clearFailedTests();
    await settlePendingTests();
    vi.restoreAllMocks();
  });

  it("does not register a failure when the evaluator responds Yes", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("Yes");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await promptCheck("value", "follow the expectation");
    const settled = await settlePendingTests();

    expect(settled).toHaveLength(1);
    expect(settled[0]?.status).toBe("fulfilled");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Suite "\u001B\[1;36m\(root\)\u001B\[0m"$/),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mpromptCheck\u001B\[0m"\n- ✅ Passed in \u001B\[1;36m\d+ms\u001B\[0m\n---$/,
      ),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(getFailedTests()).toEqual([]);
  });

  it("registers a failure when the evaluator responds No", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("No");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await promptCheck("value", "follow the expectation");
    await settlePendingTests();

    expect(getFailedTests()).toEqual([
      {
        describePath: "",
        itPath: "",
        message: "expected 'value' to satisfy 'follow the expectation'",
      },
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("registers an execution failure when evaluator output is unexpected", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("Maybe");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await promptCheck("value", "follow the expectation");
    await settlePendingTests();

    expect(getFailedTests()).toEqual([
      {
        describePath: "",
        itPath: "",
        message: "failed to evaluate expectation 'follow the expectation'",
      },
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
