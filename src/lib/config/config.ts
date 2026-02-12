import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SessionConfig } from "@github/copilot-sdk";

type KattConfig = {
  copilot?: unknown;
};

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

function parseKattConfig(content: string): KattConfig | undefined {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as KattConfig;
    }
    return undefined;
  } catch (error) {
    console.warn(`Failed to parse katt.json: ${String(error)}`);
    return undefined;
  }
}

function readCopilotConfig(
  config: KattConfig | undefined,
): SessionConfig | undefined {
  const copilot = config?.copilot;
  if (
    typeof copilot !== "object" ||
    copilot === null ||
    Array.isArray(copilot)
  ) {
    return undefined;
  }

  const sessionConfig = {
    ...(copilot as Record<string, unknown>),
  } as SessionConfig;

  const model = sessionConfig.model;
  if (typeof model !== "string" || model.length === 0) {
    delete sessionConfig.model;
  }

  return Object.keys(sessionConfig).length > 0 ? sessionConfig : undefined;
}

export async function getDefaultCopilotConfig(): Promise<
  SessionConfig | undefined
> {
  const configPath = resolve(process.cwd(), "katt.json");

  try {
    const content = await readFile(configPath, "utf8");
    return readCopilotConfig(parseKattConfig(content));
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    console.warn(`Failed to read katt.json: ${String(error)}`);
    return undefined;
  }
}

export async function getDefaultCopilotModel(): Promise<string | undefined> {
  const config = await getDefaultCopilotConfig();
  return typeof config?.model === "string" && config.model.length > 0
    ? config.model
    : undefined;
}
