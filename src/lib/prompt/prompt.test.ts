import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { evalFileStorage } from "../context/evalFileContext.js";
import { prompt, promptFile } from "./prompt.js";

const readFileMock = vi.fn();
const addUsedTokensToCurrentTestMock = vi.fn();
const setCurrentTestModelMock = vi.fn();
const getDefaultCopilotConfigMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

vi.mock("../context/context.js", () => ({
  addUsedTokensToCurrentTest: (...args: unknown[]) =>
    addUsedTokensToCurrentTestMock(...args),
  setCurrentTestModel: (...args: unknown[]) => setCurrentTestModelMock(...args),
}));

vi.mock("../config/config.js", () => ({
  getDefaultCopilotConfig: (...args: unknown[]) =>
    getDefaultCopilotConfigMock(...args),
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
  getDefaultCopilotConfigMock.mockResolvedValue(undefined);
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
    getDefaultCopilotConfigMock.mockReset();
    vi.restoreAllMocks();
  });

  it("sends the input prompt and returns the Copilot response", async () => {
    setupSessionMocks();

    const result = await prompt("Hello");

    expect(result).toBe("ok");
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(sendAndWaitMock).toHaveBeenCalledWith({ prompt: "Hello" });
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it("passes the model to Copilot session creation when provided", async () => {
    setupSessionMocks();
    getDefaultCopilotConfigMock.mockResolvedValue({ model: "gpt-4o" });

    await prompt("Hello", { model: "gpt-5.2" });

    expect(createSessionMock).toHaveBeenCalledWith({ model: "gpt-5.2" });
  });

  it("uses model from katt.json when no explicit model is provided", async () => {
    setupSessionMocks();
    getDefaultCopilotConfigMock.mockResolvedValue({ model: "gpt-4o" });

    await prompt("Hello");

    expect(createSessionMock).toHaveBeenCalledWith({ model: "gpt-4o" });
  });

  it("passes non-model copilot config options from katt.json to session creation", async () => {
    setupSessionMocks();
    getDefaultCopilotConfigMock.mockResolvedValue({
      model: "gpt-4o",
      reasoningEffort: "high",
      streaming: true,
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
    getDefaultCopilotConfigMock.mockResolvedValue({
      model: "gpt-4o",
      streaming: false,
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
    getDefaultCopilotConfigMock.mockResolvedValue({ model: "gpt-4o" });

    await prompt("Hello");

    expect(setCurrentTestModelMock).toHaveBeenCalledWith("gpt-4o");
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
    getDefaultCopilotConfigMock.mockReset();
    vi.restoreAllMocks();
  });

  it("reads the file content and sends it as a prompt", async () => {
    readFileMock.mockResolvedValue("Hello from file");
    setupSessionMocks();

    const result = await promptFile("/tmp/prompt.md");

    expect(result).toBe("ok");
    expect(readFileMock).toHaveBeenCalledWith("/tmp/prompt.md", "utf8");
    expect(sendAndWaitMock).toHaveBeenCalledWith({
      prompt: "Hello from file",
    });
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
