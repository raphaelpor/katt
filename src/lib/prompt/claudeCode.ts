import { spawn } from "node:child_process";

type ClaudeCodeRunOptions = {
  model?: string;
  permissionMode?: string;
  dangerouslySkipPermissions?: boolean;
  maxTurns?: number;
  allowedTools?: string | string[];
  disallowedTools?: string | string[];
  appendSystemPrompt?: string;
  mcpConfig?: string;
  workingDirectory?: string;
};

type CommandResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readToolList(value: unknown): string[] {
  if (isNonEmptyString(value)) {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isNonEmptyString);
}

function readMaxTurns(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const maxTurns = Math.floor(value);
  return maxTurns > 0 ? maxTurns : undefined;
}

function buildClaudeCodeArgs(
  options: Record<string, unknown> | undefined,
): string[] {
  const claudeOptions = (options ?? {}) as ClaudeCodeRunOptions;
  const args = ["-p", "--output-format", "json"];

  if (isNonEmptyString(claudeOptions.model)) {
    args.push("--model", claudeOptions.model);
  }

  if (isNonEmptyString(claudeOptions.permissionMode)) {
    args.push("--permission-mode", claudeOptions.permissionMode);
  }

  if (claudeOptions.dangerouslySkipPermissions === true) {
    args.push("--dangerously-skip-permissions");
  }

  const maxTurns = readMaxTurns(claudeOptions.maxTurns);
  if (maxTurns !== undefined) {
    args.push("--max-turns", String(maxTurns));
  }

  const allowedTools = readToolList(claudeOptions.allowedTools);
  if (allowedTools.length > 0) {
    args.push("--allowedTools", ...allowedTools);
  }

  const disallowedTools = readToolList(claudeOptions.disallowedTools);
  if (disallowedTools.length > 0) {
    args.push("--disallowedTools", ...disallowedTools);
  }

  if (isNonEmptyString(claudeOptions.appendSystemPrompt)) {
    args.push("--append-system-prompt", claudeOptions.appendSystemPrompt);
  }

  if (isNonEmptyString(claudeOptions.mcpConfig)) {
    args.push("--mcp-config", claudeOptions.mcpConfig);
  }

  return args;
}

function runClaudeCodeCommand(
  input: string,
  args: string[],
  timeoutMs: number,
  workingDirectory: string,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
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
          `Failed to start Claude Code CLI. Ensure claude is installed and available on PATH. ${String(
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

function buildProcessFailureMessage(result: CommandResult): string {
  if (result.timedOut) {
    return "Claude Code timed out before returning a response.";
  }

  if (result.exitCode === null) {
    const signal = result.signal ?? "unknown";
    return `Claude Code exited due to signal ${signal}.`;
  }

  const stderrDetails = result.stderr.length > 0 ? ` ${result.stderr}` : "";
  return `Claude Code exited with code ${result.exitCode}.${stderrDetails}`;
}

function readErrorMessage(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const data = value as Record<string, unknown>;
  if (typeof data.error === "string" && data.error.length > 0) {
    return data.error;
  }
  if (typeof data.message === "string" && data.message.length > 0) {
    return data.message;
  }
  if (typeof data.result === "string" && data.result.length > 0) {
    return data.result;
  }
  return undefined;
}

function readResult(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const data = value as Record<string, unknown>;
  if (data.is_error === true || data.subtype === "error") {
    return undefined;
  }

  return typeof data.result === "string" && data.result.length > 0
    ? data.result
    : undefined;
}

function parseClaudeCodeOutput(output: string): string {
  if (output.length === 0) {
    throw new Error("Claude Code did not return a response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    throw new Error(
      `Claude Code returned invalid JSON output. ${String(error)}`,
    );
  }

  if (Array.isArray(parsed)) {
    for (let index = parsed.length - 1; index >= 0; index -= 1) {
      const response = readResult(parsed[index]);
      if (response) {
        return response;
      }
    }

    const errorMessage = readErrorMessage(parsed[parsed.length - 1]);
    if (errorMessage) {
      throw new Error(
        `Claude Code returned an error response. ${errorMessage}`,
      );
    }

    throw new Error(
      "Claude Code JSON output did not include a final response.",
    );
  }

  const response = readResult(parsed);
  if (response) {
    return response;
  }

  const errorMessage = readErrorMessage(parsed);
  if (errorMessage) {
    throw new Error(`Claude Code returned an error response. ${errorMessage}`);
  }

  throw new Error("Claude Code JSON output did not include a final response.");
}

export async function runClaudeCodePrompt(
  input: string,
  timeoutMs: number,
  options: Record<string, unknown> | undefined,
): Promise<string> {
  const claudeOptions = (options ?? {}) as ClaudeCodeRunOptions;
  const workingDirectory = isNonEmptyString(claudeOptions.workingDirectory)
    ? claudeOptions.workingDirectory
    : process.cwd();
  const args = buildClaudeCodeArgs(options);
  const result = await runClaudeCodeCommand(
    input,
    args,
    timeoutMs,
    workingDirectory,
  );

  if (result.timedOut) {
    throw new Error(`Claude Code timed out after ${timeoutMs}ms.`);
  }

  if (result.exitCode !== 0) {
    throw new Error(buildProcessFailureMessage(result));
  }

  return parseClaudeCodeOutput(result.stdout);
}
