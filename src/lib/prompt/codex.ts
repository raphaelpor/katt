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
): string[] {
  const codexOptions = (options ?? {}) as CodexRunOptions;
  const args = [
    "exec",
    "--color",
    "never",
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

export async function runCodexPrompt(
  input: string,
  timeoutMs: number,
  options: Record<string, unknown> | undefined,
): Promise<string> {
  const codexOptions = (options ?? {}) as CodexRunOptions;
  const workingDirectory = isNonEmptyString(codexOptions.workingDirectory)
    ? codexOptions.workingDirectory
    : process.cwd();
  const tempDir = await mkdtemp(join(tmpdir(), CODEX_TEMP_DIR_PREFIX));
  const outputFilePath = join(tempDir, CODEX_LAST_MESSAGE_FILE);

  try {
    const args = buildCodexArgs(outputFilePath, options);
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

    return response;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
