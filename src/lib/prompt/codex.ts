import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

type CodexRunOptions = {
  model?: string;
  profile?: string;
  sandbox?: string;
  fullAuto?: boolean;
  skipGitRepoCheck?: boolean;
  dangerouslyBypassApprovalsAndSandbox?: boolean;
  config?: string | string[];
  workingDirectory?: string;
};

export type CodexPromptResult = {
  response: string;
  reasoning: string;
};

type CommandResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

const CODEX_TEMP_DIR_PREFIX = "katt-codex-";
const CODEX_LAST_MESSAGE_FILE = "last-message.txt";

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readConfigOverrides(value: unknown): string[] {
  if (isNonEmptyString(value)) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter(isNonEmptyString);
  }

  return [];
}

function buildCodexArgs(
  outputFilePath: string,
  options: Record<string, unknown> | undefined,
  includeJsonOutput = false,
): string[] {
  const codexOptions = (options ?? {}) as CodexRunOptions;
  const args = [
    "exec",
    "--color",
    "never",
    ...(includeJsonOutput ? ["--json"] : []),
    "--output-last-message",
    outputFilePath,
  ];

  if (isNonEmptyString(codexOptions.model)) {
    args.push("--model", codexOptions.model);
  }

  if (isNonEmptyString(codexOptions.profile)) {
    args.push("--profile", codexOptions.profile);
  }

  if (isNonEmptyString(codexOptions.sandbox)) {
    args.push("--sandbox", codexOptions.sandbox);
  }

  if (codexOptions.fullAuto === true) {
    args.push("--full-auto");
  }

  if (codexOptions.skipGitRepoCheck === true) {
    args.push("--skip-git-repo-check");
  }

  if (codexOptions.dangerouslyBypassApprovalsAndSandbox === true) {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  }

  for (const configOverride of readConfigOverrides(codexOptions.config)) {
    args.push("--config", configOverride);
  }

  // Read the prompt from stdin.
  args.push("-");
  return args;
}

function runCodexCommand(
  input: string,
  args: string[],
  timeoutMs: number,
  workingDirectory: string,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: workingDirectory,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdin.on("error", () => {});

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(
        new Error(
          `Failed to start Codex CLI. Ensure codex is installed and available on PATH. ${String(
            error,
          )}`,
        ),
      );
    });

    child.once("close", (exitCode, signal) => {
      clearTimeout(timeoutHandle);
      resolve({
        exitCode,
        signal,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
      });
    });

    child.stdin.end(input);
  });
}

async function readCodexOutput(
  outputFilePath: string,
  fallbackOutput: string,
): Promise<string> {
  try {
    const content = await readFile(outputFilePath, "utf8");
    return content;
  } catch (error) {
    if (!isNodeErrorWithCode(error, "ENOENT")) {
      throw error;
    }

    return fallbackOutput;
  }
}

function buildProcessFailureMessage(result: CommandResult): string {
  if (result.timedOut) {
    return "Codex timed out before returning a response.";
  }

  if (result.exitCode === null) {
    const signal = result.signal ?? "unknown";
    return `Codex exited due to signal ${signal}.`;
  }

  const stderrDetails = result.stderr.length > 0 ? ` ${result.stderr}` : "";
  return `Codex exited with code ${result.exitCode}.${stderrDetails}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function collectReasoningText(
  value: unknown,
  collected: string[],
  level = 0,
): void {
  if (level > 6) {
    return;
  }

  const text = toText(value);
  if (text) {
    collected.push(text);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectReasoningText(entry, collected, level + 1);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const preferredKeys = [
    "reasoning",
    "reasoningText",
    "reasoning_text",
    "content",
    "summary",
    "deltaContent",
    "delta",
    "text",
    "intent",
    "analysis",
    "thought",
    "plan",
    "message",
  ];
  for (const key of preferredKeys) {
    if (key in value) {
      collectReasoningText(value[key], collected, level + 1);
    }
  }
}

function extractReasoningFromJsonLine(line: string): string[] {
  if (line.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) {
      return [];
    }

    const collected: string[] = [];

    const parsedType = toText(parsed.type);
    if (
      parsedType &&
      /reason|intent|plan|analysis|thought|think/i.test(parsedType)
    ) {
      collectReasoningText(parsed, collected);
    }

    if ("msg" in parsed && isRecord(parsed.msg)) {
      const messageType = toText(parsed.msg.type);
      if (
        messageType &&
        /reason|intent|plan|analysis|thought|think/i.test(messageType)
      ) {
        collectReasoningText(parsed.msg, collected);
      }
    }

    return collected;
  } catch {
    return [];
  }
}

function extractReasoningFromStdout(stdout: string): string {
  const lines = stdout.split(/\r?\n/);
  const segments: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const extracted = extractReasoningFromJsonLine(line);
    for (const segment of extracted) {
      if (!seen.has(segment)) {
        seen.add(segment);
        segments.push(segment);
      }
    }
  }

  return segments.join("\n\n");
}

async function runCodexPromptInternal(
  input: string,
  timeoutMs: number,
  options: Record<string, unknown> | undefined,
  includeReasoning: boolean,
): Promise<CodexPromptResult> {
  const codexOptions = (options ?? {}) as CodexRunOptions;
  const workingDirectory = isNonEmptyString(codexOptions.workingDirectory)
    ? codexOptions.workingDirectory
    : process.cwd();
  const tempDir = await mkdtemp(join(tmpdir(), CODEX_TEMP_DIR_PREFIX));
  const outputFilePath = join(tempDir, CODEX_LAST_MESSAGE_FILE);

  try {
    const args = buildCodexArgs(outputFilePath, options, includeReasoning);
    const result = await runCodexCommand(
      input,
      args,
      timeoutMs,
      workingDirectory,
    );

    if (result.timedOut) {
      throw new Error(`Codex timed out after ${timeoutMs}ms.`);
    }

    if (result.exitCode !== 0) {
      throw new Error(buildProcessFailureMessage(result));
    }

    const response = await readCodexOutput(outputFilePath, result.stdout);
    if (response.length === 0) {
      throw new Error("Codex did not return a response.");
    }

    return {
      response,
      reasoning: includeReasoning
        ? extractReasoningFromStdout(result.stdout)
        : "",
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function runCodexPrompt(
  input: string,
  timeoutMs: number,
  options: Record<string, unknown> | undefined,
): Promise<string> {
  const result = await runCodexPromptInternal(input, timeoutMs, options, false);
  return result.response;
}

export async function runCodexPromptWithReasoning(
  input: string,
  timeoutMs: number,
  options: Record<string, unknown> | undefined,
): Promise<CodexPromptResult> {
  return runCodexPromptInternal(input, timeoutMs, options, true);
}
