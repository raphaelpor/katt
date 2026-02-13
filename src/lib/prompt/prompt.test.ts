import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { evalFileStorage } from "../context/evalFileContext.js";
import { DEFAULT_PROMPT_TIMEOUT_MS, prompt, promptFile } from "./prompt.js";

const readFileMock = vi.fn();
const addUsedTokensToCurrentTestMock = vi.fn();
const setCurrentTestModelMock = vi.fn();
const getDefaultKattConfigMock = vi.fn();

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

let sendAndWaitMock: ReturnType<typeof vi.fn>;
let destroyMock: ReturnType<typeof vi.fn>;
let startMock: ReturnType<typeof vi.fn>;
let stopMock: ReturnType<typeof vi.fn>;
let createSessionMock: ReturnType<typeof vi.fn>;
let onMock: ReturnType<typeof vi.fn>;
let unsubscribeMock: ReturnType<typeof vi.fn>;

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
) {
  getDefaultKattConfigMock.mockResolvedValue({
    copilot: undefined,
    promptTimeoutMs: undefined,
  });
  sendAndWaitMock = vi.fn().mockResolvedValue({ data: { content: "ok" } });
  destroyMock = destroyError
    ? vi.fn().mockRejectedValue(destroyError)
    : vi.fn().mockResolvedValue(undefined);
  startMock = vi.fn().mockResolvedValue(undefined);
  stopMock = vi.fn().mockResolvedValue(stopErrors);
  unsubscribeMock = vi.fn();
  onMock = vi.fn(
    (eventType: string, handler: (event: { data: UsageData }) => void) => {
      if (eventType === "assistant.usage") {
        for (const eventData of usageEvents) {
          handler({ data: eventData });
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
  return { CopilotClient };
});

describe("prompt", () => {
  afterEach(async () => {
    readFileMock.mockReset();
    addUsedTokensToCurrentTestMock.mockReset();
    setCurrentTestModelMock.mockReset();
    getDefaultKattConfigMock.mockReset();
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
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it("passes the model to Copilot session creation when provided", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      copilot: { model: "gpt-4o" },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello", { model: "gpt-5.2" });

    expect(createSessionMock).toHaveBeenCalledWith({ model: "gpt-5.2" });
  });

  it("uses model from katt.json when no explicit model is provided", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      copilot: { model: "gpt-4o" },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello");

    expect(createSessionMock).toHaveBeenCalledWith({ model: "gpt-4o" });
  });

  it("passes non-model copilot config options from katt.json to session creation", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      copilot: {
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
    });
  });

  it("allows explicit options to override katt.json session options", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      copilot: {
        model: "gpt-4o",
        streaming: false,
      },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello", { model: "gpt-5.2", streaming: true });

    expect(createSessionMock).toHaveBeenCalledWith({
      model: "gpt-5.2",
      streaming: true,
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
      copilot: { model: "gpt-4o" },
      promptTimeoutMs: undefined,
    });

    await prompt("Hello");

    expect(setCurrentTestModelMock).toHaveBeenCalledWith("gpt-4o");
  });

  it("uses prompt timeout from katt.json when no explicit timeout is provided", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      copilot: undefined,
      promptTimeoutMs: 240000,
    });

    await prompt("Hello");

    expect(sendAndWaitMock).toHaveBeenCalledWith({ prompt: "Hello" }, 240000);
  });

  it("lets explicit timeout override katt.json prompt timeout", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      copilot: undefined,
      promptTimeoutMs: 240000,
    });

    await prompt("Hello", { timeoutMs: 300000 });

    expect(sendAndWaitMock).toHaveBeenCalledWith({ prompt: "Hello" }, 300000);
  });

  it("ignores invalid timeout values and falls back to the default timeout", async () => {
    setupSessionMocks();
    getDefaultKattConfigMock.mockResolvedValue({
      copilot: undefined,
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

    expect(createSessionMock).toHaveBeenCalledWith({ model: "gpt-5.2" });
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
});

describe("promptFile", () => {
  afterEach(async () => {
    readFileMock.mockReset();
    addUsedTokensToCurrentTestMock.mockReset();
    setCurrentTestModelMock.mockReset();
    getDefaultKattConfigMock.mockReset();
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

    expect(createSessionMock).toHaveBeenCalledWith({ model: "gpt-5.2" });
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
