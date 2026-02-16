import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SessionConfig } from "@github/copilot-sdk";

export type KattAgent = "gh-copilot" | "codex";

type KattConfig = {
  agent?: unknown;
  agentOptions?: unknown;
  prompt?: unknown;
};

export type KattDefaults = {
  agent: KattAgent;
  agentOptions?: Record<string, unknown>;
  promptTimeoutMs?: number;
};

const DEFAULT_AGENT: KattAgent = "gh-copilot";
const DEFAULT_CONFIG_FILE_NAME = "katt.json";
let configuredConfigFilePath: string | undefined;

type ConfigPathDetails = {
  resolvedPath: string;
  label: string;
};

function getConfigPathDetails(): ConfigPathDetails {
  if (
    typeof configuredConfigFilePath === "string" &&
    configuredConfigFilePath.length > 0
  ) {
    return {
      resolvedPath: resolve(process.cwd(), configuredConfigFilePath),
      label: configuredConfigFilePath,
    };
  }

  return {
    resolvedPath: resolve(process.cwd(), DEFAULT_CONFIG_FILE_NAME),
    label: DEFAULT_CONFIG_FILE_NAME,
  };
}

export function setKattConfigFilePath(
  configFilePath: string | undefined,
): void {
  configuredConfigFilePath = configFilePath;
}

function isNodeErrorWithCode(
  value: unknown,
  code: string,
): value is { code: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (value as { code?: unknown }).code === code
  );
}

function parseKattConfig(
  content: string,
  configFileLabel: string,
): KattConfig | undefined {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as KattConfig;
    }
    return undefined;
  } catch (error) {
    console.warn(`Failed to parse ${configFileLabel}: ${String(error)}`);
    return undefined;
  }
}

async function readKattConfig(): Promise<KattConfig | undefined> {
  const { resolvedPath, label } = getConfigPathDetails();

  try {
    const content = await readFile(resolvedPath, "utf8");
    return parseKattConfig(content, label);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    console.warn(`Failed to read ${label}: ${String(error)}`);
    return undefined;
  }
}

function readSupportedAgent(agent: unknown): KattAgent | undefined {
  if (agent === "gh-copilot" || agent === "codex") {
    return agent;
  }

  return undefined;
}

function readAgentConfig(
  config: KattConfig | undefined,
  agent: KattAgent,
): Record<string, unknown> | undefined {
  if (!config) {
    return undefined;
  }

  if (readSupportedAgent(config?.agent) !== agent) {
    return undefined;
  }

  const agentOptions = config.agentOptions;
  if (
    typeof agentOptions !== "object" ||
    agentOptions === null ||
    Array.isArray(agentOptions)
  ) {
    return undefined;
  }

  const sessionConfig = { ...(agentOptions as Record<string, unknown>) };
  const model = sessionConfig.model;
  if (typeof model !== "string" || model.length === 0) {
    delete sessionConfig.model;
  }

  return Object.keys(sessionConfig).length > 0 ? sessionConfig : undefined;
}

function normalizeTimeoutMs(timeoutMs: unknown): number | undefined {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return undefined;
  }
  if (timeoutMs <= 0) {
    return undefined;
  }
  return Math.floor(timeoutMs);
}

function readPromptTimeoutMs(
  config: KattConfig | undefined,
): number | undefined {
  const prompt = config?.prompt;
  if (typeof prompt !== "object" || prompt === null || Array.isArray(prompt)) {
    return undefined;
  }

  return normalizeTimeoutMs((prompt as Record<string, unknown>).timeoutMs);
}

export async function getDefaultKattConfig(): Promise<KattDefaults> {
  const config = await readKattConfig();
  const agent = readSupportedAgent(config?.agent) ?? DEFAULT_AGENT;

  return {
    agent,
    agentOptions: readAgentConfig(config, agent),
    promptTimeoutMs: readPromptTimeoutMs(config),
  };
}

export async function getDefaultCopilotConfig(): Promise<
  SessionConfig | undefined
> {
  const config = await getDefaultKattConfig();
  if (config.agent !== "gh-copilot") {
    return undefined;
  }

  return config.agentOptions as SessionConfig | undefined;
}

export async function getDefaultPromptTimeoutMs(): Promise<number | undefined> {
  const config = await getDefaultKattConfig();
  return config.promptTimeoutMs;
}

export async function getDefaultCopilotModel(): Promise<string | undefined> {
  const config = await getDefaultCopilotConfig();
  return typeof config?.model === "string" && config.model.length > 0
    ? config.model
    : undefined;
}
