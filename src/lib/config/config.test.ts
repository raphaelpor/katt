import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultCopilotConfig,
  getDefaultCopilotModel,
  getDefaultKattConfig,
  getDefaultPromptTimeoutMs,
} from "./config.js";

const readFileMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

describe("getDefaultCopilotModel", () => {
  afterEach(() => {
    readFileMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns undefined when katt.json does not exist", async () => {
    const missingFileError = Object.assign(new Error("missing"), {
      code: "ENOENT",
    });
    readFileMock.mockRejectedValue(missingFileError);

    const result = await getDefaultCopilotModel();

    expect(result).toBeUndefined();
  });

  it("returns model from katt.json when configured", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "gh-copilot",
        agentOptions: { model: "gpt-5.2" },
      }),
    );

    const result = await getDefaultCopilotModel();

    expect(result).toBe("gpt-5.2");
  });

  it("returns undefined and warns when katt.json has invalid json", async () => {
    readFileMock.mockResolvedValue("{ this is not valid json");
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getDefaultCopilotModel();

    expect(result).toBeUndefined();
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse katt.json:"),
    );
  });

  it("returns undefined when agentOptions.model is missing or invalid", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "gh-copilot",
        agentOptions: { model: 123 },
      }),
    );

    const result = await getDefaultCopilotModel();

    expect(result).toBeUndefined();
  });

  it("returns undefined and warns when katt.json cannot be read", async () => {
    readFileMock.mockRejectedValue(new Error("permission denied"));
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getDefaultCopilotModel();

    expect(result).toBeUndefined();
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to read katt.json:"),
    );
  });
});

describe("getDefaultCopilotConfig", () => {
  afterEach(() => {
    readFileMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns undefined when katt.json does not exist", async () => {
    const missingFileError = Object.assign(new Error("missing"), {
      code: "ENOENT",
    });
    readFileMock.mockRejectedValue(missingFileError);

    const result = await getDefaultCopilotConfig();

    expect(result).toBeUndefined();
  });

  it("returns agentOptions from katt.json when configured", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "gh-copilot",
        agentOptions: {
          model: "gpt-5.2",
          reasoningEffort: "high",
          streaming: true,
        },
      }),
    );

    const result = await getDefaultCopilotConfig();

    expect(result).toEqual({
      model: "gpt-5.2",
      reasoningEffort: "high",
      streaming: true,
    });
  });

  it("filters empty string model while preserving other settings", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "gh-copilot",
        agentOptions: { model: "", streaming: true },
      }),
    );

    const result = await getDefaultCopilotConfig();

    expect(result).toEqual({ streaming: true });
  });

  it("returns undefined when agent is unsupported", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "openai",
        agentOptions: { model: "gpt-5.2" },
      }),
    );

    const result = await getDefaultCopilotConfig();

    expect(result).toBeUndefined();
  });

  it("returns undefined when agentOptions is not an object", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "gh-copilot",
        agentOptions: "invalid",
      }),
    );

    const result = await getDefaultCopilotConfig();

    expect(result).toBeUndefined();
  });

  it("returns undefined when only invalid model exists in agentOptions", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "gh-copilot",
        agentOptions: { model: "" },
      }),
    );

    const result = await getDefaultCopilotConfig();

    expect(result).toBeUndefined();
  });
});

describe("getDefaultPromptTimeoutMs", () => {
  afterEach(() => {
    readFileMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns undefined when katt.json does not exist", async () => {
    const missingFileError = Object.assign(new Error("missing"), {
      code: "ENOENT",
    });
    readFileMock.mockRejectedValue(missingFileError);

    const result = await getDefaultPromptTimeoutMs();

    expect(result).toBeUndefined();
  });

  it("returns timeout from katt.json when configured", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({ prompt: { timeoutMs: 240000 } }),
    );

    const result = await getDefaultPromptTimeoutMs();

    expect(result).toBe(240000);
  });

  it("normalizes timeout to a positive integer", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({ prompt: { timeoutMs: 240000.9 } }),
    );

    const result = await getDefaultPromptTimeoutMs();

    expect(result).toBe(240000);
  });

  it("returns undefined for invalid timeout values", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({ prompt: { timeoutMs: "120000" } }),
    );

    const result = await getDefaultPromptTimeoutMs();

    expect(result).toBeUndefined();
  });
});

describe("getDefaultKattConfig", () => {
  afterEach(() => {
    readFileMock.mockReset();
    vi.restoreAllMocks();
  });

  it("returns both agent options and prompt defaults when configured", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "gh-copilot",
        agentOptions: { model: "gpt-5.2", streaming: true },
        prompt: { timeoutMs: 300000 },
      }),
    );

    const result = await getDefaultKattConfig();

    expect(result).toEqual({
      agentOptions: { model: "gpt-5.2", streaming: true },
      promptTimeoutMs: 300000,
    });
  });
});
