import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { evalFileStorage } from "../context/evalFileContext.js";
import { DEFAULT_PROMPT_TIMEOUT_MS, prompt, promptFile } from "./prompt.js";

const readFileMock = vi.fn();
const addUsedTokensToCurrentTestMock = vi.fn();
const setCurrentTestModelMock = vi.fn();
const getDefaultKattConfigMock = vi.fn();
const runCodexPromptMock = vi.fn();
const runCodexPromptWithReasoningMock = vi.fn();
const getSaveReasoningModeMock = vi.fn();
const saveReasoningTraceMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

vi.mock("../context/context.js", () => ({
  addUsedTokensToCurrentTest: (...args: unknown[]) =>
    addUsedTokensToCurrentTestMock(...args),
  setCurrentTestModel: (...args: unknown[]) => setCurrentTestModelMock(...args),
}));

vi.mock("../config/config.js", () => ({
  getDefaultKattConfig: (...args: unknown[]) =>
    getDefaultKattConfigMock(...args),
}));

vi.mock("./codex.js", () => ({
  runCodexPrompt: (...args: unknown[]) => runCodexPromptMock(...args),
  runCodexPromptWithReasoning: (...args: unknown[]) =>
    runCodexPromptWithReasoningMock(...args),
}));

vi.mock("./reasoningConfig.js", () => ({
  getSaveReasoningMode: (...args: unknown[]) =>
    getSaveReasoningModeMock(...args),
}));

vi.mock("./reasoningWriter.js", () => ({
  saveReasoningTrace: (...args: unknown[]) => saveReasoningTraceMock(...args),
}));

let sendAndWaitMock: ReturnType<
  typeof vi.fn<() => Promise<{ data: { content: string } }>>
>;
let destroyMock: ReturnType<typeof vi.fn<() => Promise<void>>>;
let startMock: ReturnType<typeof vi.fn<() => Promise<void>>>;
let stopMock: ReturnType<typeof vi.fn<() => Promise<Error[]>>>;
let createSessionMock: ReturnType<
  typeof vi.fn<
    (...args: unknown[]) => Promise<{
      on: typeof onMock;
      sendAndWait: typeof sendAndWaitMock;
      destroy: typeof destroyMock;
    }>
  >
>;
let onMock: ReturnType<
  typeof vi.fn<
    (
      eventType: string,
      handler: (event: { data: Record<string, unknown> }) => void,
    ) => typeof unsubscribeMock
  >
>;
let unsubscribeMock: ReturnType<typeof vi.fn<() => void>>;

type UsageData = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

function setupSessionMocks(
  usageEvents: UsageData[] = [],
  stopErrors: Error[] = [],
  destroyError?: Error,
  reasoningEvents: string[] = [],
  intentEvents: string[] = [],
  responseReasoningText?: string,
) {
  getDefaultKattConfigMock.mockResolvedValue({
    agent: "gh-copilot",
    agentOptions: undefined,
    promptTimeoutMs: undefined,
  });
  runCodexPromptMock.mockResolvedValue("codex response");
  runCodexPromptWithReasoningMock.mockResolvedValue({
    response: "codex response",
    reasoning: "codex reasoning",
  });
  getSaveReasoningModeMock.mockReturnValue(false);
  saveReasoningTraceMock.mockResolvedValue(undefined);
  sendAndWaitMock = vi.fn().mockResolvedValue({
    data: {
      content: "ok",
      ...(responseReasoningText
        ? { reasoningText: responseReasoningText }
        : {}),
    },
  });
  destroyMock = destroyError
    ? vi.fn().mockRejectedValue(destroyError)
    : vi.fn().mockResolvedValue(undefined);
  startMock = vi.fn().mockResolvedValue(undefined);
  stopMock = vi.fn().mockResolvedValue(stopErrors);
  unsubscribeMock = vi.fn();
  onMock = vi.fn(
    (
      eventType: string,
      handler: (event: { data: Record<string, unknown> }) => void,
    ) => {
      if (eventType === "assistant.usage") {
        for (const eventData of usageEvents) {
          handler({ data: eventData as unknown as Record<string, unknown> });
        }
      }
      if (eventType === "assistant.reasoning") {
        for (const reasoning of reasoningEvents) {
          handler({ data: { content: reasoning } });
        }
      }
      if (eventType === "assistant.intent") {
        for (const intent of intentEvents) {
          handler({ data: { intent } });
        }
      }
      return unsubscribeMock;
    },
  );
  createSessionMock = vi.fn().mockResolvedValue({
    on: onMock,
    sendAndWait: sendAndWaitMock,
    destroy: destroyMock,
  });
}

vi.mock("@github/copilot-sdk", () => {
  class CopilotClient {
    async start() {
      return startMock();
    }
    async stop() {
      return stopMock();
    }
    async createSession(...args: unknown[]) {
      return createSessionMock(...args);
    }
  }
  const approveAll = vi.fn();
  return { CopilotClient, approveAll };
});

describe("prompt", () => {
  afterEach(async () => {
    readFileMock.mockReset();
    addUsedTokensToCurrentTestMock.mockReset();
    setCurrentTestModelMock.mockReset();
    getDefaultKattConfigMock.mockReset();
    runCodexPromptMock.mockReset();
    runCodexPromptWithReasoningMock.mockReset();
    getSaveReasoningModeMock.mockReset();
    saveReasoningTraceMock.mockReset();
    vi.restoreAllMocks();
  });

  it("sends the input prompt and returns the Copilot response", async () => {
    setupSessionMocks();

    const result = await prompt("Hello");

    expect(result).toBe("ok");
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(sendAndWaitMock).toHaveBeenCalledWith(
      { prompt: "Hello" },
      DEFAULT_PROMPT_TIMEOUT_MS,
    );
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(unsubscribeMock).toHaveBeenCalledTimes(3);
  });

  it("passes the model to Copilot session creation when provided", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "gh-copilot",
      agentOptions: { model: "gpt-4o" },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello", { model: "gpt-5.2" });

    expect(createSessionMock).toHaveBeenCalledWith({
      model: "gpt-5.2",
      onPermissionRequest: expect.any(Function),
    });
  });

  it("uses model from katt.json when no explicit model is provided", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "gh-copilot",
      agentOptions: { model: "gpt-4o" },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello");

    expect(createSessionMock).toHaveBeenCalledWith({
      model: "gpt-4o",
      onPermissionRequest: expect.any(Function),
    });
  });

  it("passes non-model agent options from katt.json to session creation", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "gh-copilot",
      agentOptions: {
        model: "gpt-4o",
        reasoningEffort: "high",
        streaming: true,
      },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello");

    expect(createSessionMock).toHaveBeenCalledWith({
      model: "gpt-4o",
      reasoningEffort: "high",
      streaming: true,
      onPermissionRequest: expect.any(Function),
    });
  });

  it("allows explicit options to override katt.json session options", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "gh-copilot",
      agentOptions: {
        model: "gpt-4o",
        streaming: false,
      },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello", { model: "gpt-5.2", streaming: true });

    expect(createSessionMock).toHaveBeenCalledWith({
      model: "gpt-5.2",
      streaming: true,
      onPermissionRequest: expect.any(Function),
    });
  });

  it("tracks model usage for the active test", async () => {
    setupSessionMocks();

    await prompt("Hello", { model: "gpt-5.2" });

    expect(setCurrentTestModelMock).toHaveBeenCalledWith("gpt-5.2");
  });

  it("tracks config model usage for the active test", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "gh-copilot",
      agentOptions: { model: "gpt-4o" },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello");

    expect(setCurrentTestModelMock).toHaveBeenCalledWith("gpt-4o");
  });

  it("uses prompt timeout from katt.json when no explicit timeout is provided", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "gh-copilot",
      agentOptions: undefined,
      promptTimeoutMs: 240000,
    });

    await prompt("Hello");

    expect(sendAndWaitMock).toHaveBeenCalledWith({ prompt: "Hello" }, 240000);
  });

  it("lets explicit timeout override katt.json prompt timeout", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "gh-copilot",
      agentOptions: undefined,
      promptTimeoutMs: 240000,
    });

    await prompt("Hello", { timeoutMs: 300000 });

    expect(sendAndWaitMock).toHaveBeenCalledWith({ prompt: "Hello" }, 300000);
  });

  it("ignores invalid timeout values and falls back to the default timeout", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "gh-copilot",
      agentOptions: undefined,
      promptTimeoutMs: -1,
    });

    await prompt("Hello", { timeoutMs: 0 });

    expect(sendAndWaitMock).toHaveBeenCalledWith(
      { prompt: "Hello" },
      DEFAULT_PROMPT_TIMEOUT_MS,
    );
  });

  it("does not pass timeoutMs to session creation options", async () => {
    setupSessionMocks();

    await prompt("Hello", { model: "gpt-5.2", timeoutMs: 300000 });

    expect(createSessionMock).toHaveBeenCalledWith({
      model: "gpt-5.2",
      onPermissionRequest: expect.any(Function),
    });
  });

  it("tracks assistant usage as test token usage", async () => {
    setupSessionMocks([
      { inputTokens: 10, outputTokens: 4 },
      { cacheReadTokens: 2, cacheWriteTokens: 1 },
    ]);

    await prompt("Hello");

    expect(addUsedTokensToCurrentTestMock).toHaveBeenCalledWith(17);
  });

  it("logs cleanup errors when Copilot cleanup fails", async () => {
    setupSessionMocks(
      [],
      [new Error("stop failed")],
      new Error("destroy failed"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await prompt("Hello");

    expect(errorSpy).toHaveBeenCalledWith(
      "Copilot cleanup encountered 2 error(s).",
    );
  });

  it("uses Codex runtime when configured", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "codex",
      agentOptions: { model: "gpt-5-codex", profile: "default" },
      promptTimeoutMs: 450000,
    });
    runCodexPromptMock.mockResolvedValue("codex answer");

    const result = await prompt("Hello");

    expect(result).toBe("codex answer");
    expect(runCodexPromptMock).toHaveBeenCalledWith("Hello", 450000, {
      model: "gpt-5-codex",
      profile: "default",
    });
    expect(runCodexPromptWithReasoningMock).not.toHaveBeenCalled();
    expect(saveReasoningTraceMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("lets explicit options override codex defaults", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "codex",
      agentOptions: { model: "gpt-5-codex", profile: "default" },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello", { model: "gpt-5.2-codex", profile: "fast" });

    expect(runCodexPromptMock).toHaveBeenCalledWith(
      "Hello",
      DEFAULT_PROMPT_TIMEOUT_MS,
      {
        model: "gpt-5.2-codex",
        profile: "fast",
      },
    );
    expect(runCodexPromptWithReasoningMock).not.toHaveBeenCalled();
    expect(setCurrentTestModelMock).toHaveBeenCalledWith("gpt-5.2-codex");
  });

  it("saves copilot reasoning when save mode is enabled", async () => {
    setupSessionMocks(
      [],
      [],
      undefined,
      ["first reasoning block"],
      ["planning next step"],
      "final reasoning text",
    );
    getSaveReasoningModeMock.mockReturnValue(true);

    await prompt("Hello");

    expect(saveReasoningTraceMock).toHaveBeenCalledWith(
      "gh-copilot",
      expect.stringContaining("Intent: planning next step"),
      "ok",
    );
    expect(saveReasoningTraceMock).toHaveBeenCalledWith(
      "gh-copilot",
      expect.stringContaining("first reasoning block"),
      "ok",
    );
    expect(saveReasoningTraceMock).toHaveBeenCalledWith(
      "gh-copilot",
      expect.stringContaining("final reasoning text"),
      "ok",
    );
  });

  it("saves an empty copilot reasoning payload when no reasoning is emitted", async () => {
    setupSessionMocks();
    getSaveReasoningModeMock.mockReturnValue(true);

    await prompt("Hello");

    expect(saveReasoningTraceMock).toHaveBeenCalledWith("gh-copilot", "", "ok");
  });

  it("uses codex reasoning capture when save mode is enabled", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      agent: "codex",
      agentOptions: { model: "gpt-5-codex" },
      promptTimeoutMs: 450000,
    });
    getSaveReasoningModeMock.mockReturnValue(true);
    runCodexPromptWithReasoningMock.mockResolvedValue({
      response: "codex answer",
      reasoning: "codex reasoning trace",
    });

    const result = await prompt("Hello");

    expect(result).toBe("codex answer");
    expect(runCodexPromptWithReasoningMock).toHaveBeenCalledWith(
      "Hello",
      450000,
      {
        model: "gpt-5-codex",
      },
    );
    expect(runCodexPromptMock).not.toHaveBeenCalled();
    expect(saveReasoningTraceMock).toHaveBeenCalledWith(
      "codex",
      "codex reasoning trace",
      "codex answer",
    );
  });
});

describe("promptFile", () => {
  afterEach(async () => {
    readFileMock.mockReset();
    addUsedTokensToCurrentTestMock.mockReset();
    setCurrentTestModelMock.mockReset();
    getDefaultKattConfigMock.mockReset();
    runCodexPromptMock.mockReset();
    runCodexPromptWithReasoningMock.mockReset();
    getSaveReasoningModeMock.mockReset();
    saveReasoningTraceMock.mockReset();
    vi.restoreAllMocks();
  });

  it("reads the file content and sends it as a prompt", async () => {
    readFileMock.mockResolvedValue("Hello from file");
    setupSessionMocks();

    const result = await promptFile("/tmp/prompt.md");

    expect(result).toBe("ok");
    expect(readFileMock).toHaveBeenCalledWith("/tmp/prompt.md", "utf8");
    expect(sendAndWaitMock).toHaveBeenCalledWith(
      {
        prompt: "Hello from file",
      },
      DEFAULT_PROMPT_TIMEOUT_MS,
    );
  });

  it("passes the model option through to prompt", async () => {
    readFileMock.mockResolvedValue("Hello from file");
    setupSessionMocks();

    await promptFile("/tmp/prompt.md", { model: "gpt-5.2" });

    expect(createSessionMock).toHaveBeenCalledWith({
      model: "gpt-5.2",
      onPermissionRequest: expect.any(Function),
    });
  });

  it("resolves relative paths against the eval file directory", async () => {
    readFileMock.mockResolvedValue("Hello from file");
    setupSessionMocks();

    const evalFilePath = "/tmp/suite/example.eval.js";
    const expectedPath = join("/tmp/suite", "prompt.md");

    const result = await evalFileStorage.run({ evalFile: evalFilePath }, () =>
      promptFile("./prompt.md"),
    );

    expect(result).toBe("ok");
    expect(readFileMock).toHaveBeenCalledWith(expectedPath, "utf8");
  });
});
