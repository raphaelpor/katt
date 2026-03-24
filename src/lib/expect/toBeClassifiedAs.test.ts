import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearFailedTests,
  getFailedTests,
  resetDescribeContext,
  resetItContext,
  settlePendingTests,
} from "../context/context.js";
import { prompt } from "../prompt/prompt.js";
import { toBeClassifiedAs } from "./toBeClassifiedAs.js";

vi.mock("../prompt/prompt.js", () => ({
  prompt: vi.fn(),
}));

describe("toBeClassifiedAs", () => {
  afterEach(async () => {
    resetDescribeContext();
    resetItContext();
    clearFailedTests();
    await settlePendingTests();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("does not register a failure when score is greater than or equal to the threshold", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("4");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await toBeClassifiedAs("some response", "helpful", { threshold: 4 });
    const settled = await settlePendingTests();

    expect(settled).toHaveLength(1);
    expect(settled[0]?.status).toBe("fulfilled");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Suite "\u001B\[1;36m\(root\)\u001B\[0m"$/),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mtoBeClassifiedAs\u001B\[0m"\n- Finished in \u001B\[1;36m\d+ ms\u001B\[0m\n---$/,
      ),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(getFailedTests()).toEqual([]);
  });

  it("registers a failure when score is below the threshold", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("2");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await toBeClassifiedAs("some response", "helpful", { threshold: 4 });
    await settlePendingTests();

    expect(getFailedTests()).toEqual([
      {
        describePath: "",
        itPath: "",
        message:
          "expected response to be classified as 'helpful' with score >= 4, got 2",
      },
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("uses threshold 3 by default", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("3");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await toBeClassifiedAs("some response", "harmless");
    await settlePendingTests();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mtoBeClassifiedAs\u001B\[0m"\n- Finished in \u001B\[1;36m\d+ ms\u001B\[0m\n---$/,
      ),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(getFailedTests()).toEqual([]);
  });

  it("registers a failure when evaluator output does not contain a score", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("I think it is helpful.");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await toBeClassifiedAs("some response", "helpful");
    await settlePendingTests();

    expect(getFailedTests()).toEqual([
      {
        describePath: "",
        itPath: "",
        message:
          "failed to classify as 'helpful'. Evaluator returned 'I think it is helpful.'",
      },
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("passes model option to the evaluator prompt", async () => {
    const promptMock = vi.mocked(prompt);
    promptMock.mockResolvedValue("5");

    await toBeClassifiedAs("some response", "helpful", { model: "gpt-5.2" });
    await settlePendingTests();

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(promptMock).toHaveBeenCalledWith(
      expect.stringContaining('Classify the input by how "helpful" it is'),
      { model: "gpt-5.2" },
    );
  });
});
