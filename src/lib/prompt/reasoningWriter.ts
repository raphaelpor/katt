import { access, constants, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { getDescribeContext, getItContext } from "../context/context.js";
import { evalFileStorage } from "../context/evalFileContext.js";

const NO_REASONING_PLACEHOLDER =
  "No reasoning was emitted by the runtime for this prompt.";
const NO_FINAL_OUTPUT_PLACEHOLDER =
  "No final output was returned by the runtime for this prompt.";

function sanitizeReasoningSegment(segment: string): string {
  const normalized = segment
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : "unnamed";
}

function buildContextSegment(): string {
  const describePath = getDescribeContext().map((entry) =>
    sanitizeReasoningSegment(entry.description),
  );
  const itPath = getItContext().map((entry) =>
    sanitizeReasoningSegment(entry.description),
  );
  const allSegments = [...describePath, ...itPath];

  if (allSegments.length === 0) {
    return "root";
  }

  return allSegments.join("__");
}

function formatUtcTimestamp(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function buildReasoningContent(
  runtime: string,
  reasoning: string,
  finalOutput: string,
): string {
  const reasoningBody =
    reasoning.trim().length > 0 ? reasoning : NO_REASONING_PLACEHOLDER;
  const finalOutputBody =
    finalOutput.trim().length > 0 ? finalOutput : NO_FINAL_OUTPUT_PLACEHOLDER;
  return [
    "# Reasoning",
    "",
    `Runtime: ${runtime}`,
    "",
    "## Reasoning Trace",
    "",
    reasoningBody,
    "",
    "## Final Output",
    "",
    finalOutputBody,
    "",
  ].join("\n");
}

function getBaseReasoningFilePath(evalFilePath: string): string {
  const evalFileName = basename(evalFilePath);
  const evalFileBaseName = evalFileName.replace(/\.eval\.[^./\\]+$/, "");
  const contextSegment = buildContextSegment();
  return join(
    dirname(evalFilePath),
    "__reasoning__",
    `${evalFileBaseName}__${contextSegment}.reasoning.md`,
  );
}

function addTimestampToReasoningFilePath(filePath: string): string {
  const timestamp = formatUtcTimestamp(new Date());
  const baseWithoutSuffix = filePath.replace(/\.reasoning\.md$/, "");
  return `${baseWithoutSuffix}__${timestamp}.reasoning.md`;
}

export async function saveReasoningTrace(
  runtime: string,
  reasoning: string,
  finalOutput: string,
): Promise<string | undefined> {
  const evalFilePath = evalFileStorage.getStore()?.evalFile;
  if (!evalFilePath) {
    return undefined;
  }

  const baseFilePath = getBaseReasoningFilePath(evalFilePath);
  await mkdir(dirname(baseFilePath), { recursive: true });
  const targetFilePath = (await fileExists(baseFilePath))
    ? addTimestampToReasoningFilePath(baseFilePath)
    : baseFilePath;
  await writeFile(
    targetFilePath,
    buildReasoningContent(runtime, reasoning, finalOutput),
    "utf8",
  );
  return targetFilePath;
}

export { NO_REASONING_PLACEHOLDER, NO_FINAL_OUTPUT_PLACEHOLDER };
