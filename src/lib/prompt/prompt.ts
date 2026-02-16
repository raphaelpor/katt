import { CopilotClient, type CopilotSession } from "@github/copilot-sdk";
import type { SessionConfig } from "@github/copilot-sdk";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  addUsedTokensToCurrentTest,
  setCurrentTestModel,
} from "../context/context.js";
import { evalFileStorage } from "../context/evalFileContext.js";
import { getDefaultKattConfig } from "../config/config.js";
import { runCodexPrompt } from "./codex.js";

export const DEFAULT_PROMPT_TIMEOUT_MS = 600_000;

export type PromptOptions = SessionConfig &
  Record<string, unknown> & {
    timeoutMs?: number;
  };

function normalizeModel(model: string | undefined): string | undefined {
  return typeof model === "string" && model.length > 0 ? model : undefined;
}

function normalizeAgentConfig(
  config: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!config) {
    return undefined;
  }

  const normalized = { ...config };
  if (normalized.model !== undefined) {
    const model = normalizeModel(
      typeof normalized.model === "string" ? normalized.model : undefined,
    );
    if (model) {
      normalized.model = model;
    } else {
      delete normalized.model;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
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

function toNonNegativeInteger(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return 0;
  }
  return Math.floor(value ?? 0);
}

function getUsageTokens(data: {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): number {
  return (
    toNonNegativeInteger(data.inputTokens) +
    toNonNegativeInteger(data.outputTokens) +
    toNonNegativeInteger(data.cacheReadTokens) +
    toNonNegativeInteger(data.cacheWriteTokens)
  );
}

export async function prompt(
  input: string,
  options: PromptOptions = {},
): Promise<string> {
  const { timeoutMs: explicitTimeoutMsRaw, ...explicitSessionConfig } = options;
  const defaults = await getDefaultKattConfig();
  const configOptions = normalizeAgentConfig(defaults.agentOptions);
  const explicitOptions = normalizeAgentConfig(
    explicitSessionConfig as Record<string, unknown>,
  );
  const sessionOptions = normalizeAgentConfig({
    ...(configOptions ?? {}),
    ...(explicitOptions ?? {}),
  });
  const configuredTimeoutMs = normalizeTimeoutMs(defaults.promptTimeoutMs);
  const explicitTimeoutMs = normalizeTimeoutMs(explicitTimeoutMsRaw);
  const timeoutMs =
    explicitTimeoutMs ?? configuredTimeoutMs ?? DEFAULT_PROMPT_TIMEOUT_MS;
  const model = normalizeModel(
    typeof sessionOptions?.model === "string"
      ? sessionOptions.model
      : undefined,
  );

  if (defaults.agent === "codex") {
    const response = await runCodexPrompt(input, timeoutMs, sessionOptions);

    if (model) {
      setCurrentTestModel(model);
    }

    return response;
  }

  const client = new CopilotClient({ useLoggedInUser: true });
  let session: CopilotSession | undefined;
  let unsubscribeUsage: (() => void) | undefined;
  let usedTokens = 0;

  try {
    await client.start();
    session = await client.createSession(sessionOptions as SessionConfig);
    unsubscribeUsage = session.on("assistant.usage", (event) => {
      usedTokens += getUsageTokens(event.data);
    });
    const response = await session.sendAndWait({ prompt: input }, timeoutMs);

    if (!response?.data?.content) {
      throw new Error("Copilot did not return a response.");
    }

    if (model) {
      setCurrentTestModel(model);
    }

    return response.data.content;
  } finally {
    const cleanupErrors: unknown[] = [];
    unsubscribeUsage?.();

    if (usedTokens > 0) {
      addUsedTokensToCurrentTest(usedTokens);
    }

    if (session) {
      try {
        await session.destroy();
      } catch (err) {
        cleanupErrors.push(err);
      }
    }

    try {
      const stopErrors = await client.stop();
      cleanupErrors.push(...stopErrors);
    } catch (err) {
      cleanupErrors.push(err);
    }

    if (cleanupErrors.length > 0) {
      console.error(
        `Copilot cleanup encountered ${cleanupErrors.length} error(s).`,
      );
    }
  }
}

export async function promptFile(
  filePath: string,
  options: PromptOptions = {},
): Promise<string> {
  const store = evalFileStorage.getStore();
  const baseDir = store?.evalFile ? dirname(store.evalFile) : process.cwd();
  const resolvedPath = isAbsolute(filePath)
    ? filePath
    : resolve(baseDir, filePath);
  const content = await readFile(resolvedPath, "utf8");
  return prompt(content, options);
}
