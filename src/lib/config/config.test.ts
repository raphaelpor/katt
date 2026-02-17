import { afterEach, describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import {
  getDefaultCopilotConfig,
  getDefaultCopilotModel,
  getDefaultKattConfig,
  getDefaultPromptTimeoutMs,
  setKattConfigFilePath,
} from "./config.js";

const readFileMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

describe("getDefaultCopilotModel", () => {
  afterEach(() => {
    readFileMock.mockReset();
    setKattConfigFilePath(undefined);
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
    setKattConfigFilePath(undefined);
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

  it("returns undefined when agent is codex", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "codex",
        agentOptions: { model: "gpt-5-codex" },
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
    setKattConfigFilePath(undefined);
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
    setKattConfigFilePath(undefined);
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
      agent: "gh-copilot",
      agentOptions: { model: "gpt-5.2", streaming: true },
      promptTimeoutMs: 300000,
    });
  });

  it("defaults to gh-copilot when agent is missing", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agentOptions: { model: "gpt-5.2" },
      }),
    );

    const result = await getDefaultKattConfig();

    expect(result).toEqual({
      agent: "gh-copilot",
      agentOptions: undefined,
      promptTimeoutMs: undefined,
    });
  });

  it("returns codex defaults when configured", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "codex",
        agentOptions: {
          model: "gpt-5-codex",
          profile: "default",
        },
        prompt: { timeoutMs: 450000 },
      }),
    );

    const result = await getDefaultKattConfig();

    expect(result).toEqual({
      agent: "codex",
      agentOptions: {
        model: "gpt-5-codex",
        profile: "default",
      },
      promptTimeoutMs: 450000,
    });
  });

  it("reads custom config path when configured", async () => {
    setKattConfigFilePath("./config/custom-katt.json");
    readFileMock.mockResolvedValue(
      JSON.stringify({
        agent: "gh-copilot",
        agentOptions: { model: "gpt-5.2" },
      }),
    );

    await getDefaultKattConfig();

    expect(readFileMock).toHaveBeenCalledWith(
      resolve(process.cwd(), "./config/custom-katt.json"),
      "utf8",
    );
  });

  it("warns with custom config path when custom config cannot be read", async () => {
    setKattConfigFilePath("./config/custom-katt.json");
    readFileMock.mockRejectedValue(new Error("permission denied"));
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await getDefaultKattConfig();

    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to read ./config/custom-katt.json:"),
    );
  });

  it("warns when deprecated copilot config is used", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        copilot: { model: "gpt-5.2" },
      }),
    );
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await getDefaultKattConfig();

    expect(warningSpy).toHaveBeenCalledWith(
      'Deprecated config property "copilot" found in katt.json. Use "agent" and "agentOptions" instead.',
    );
  });
});
