import { afterEach, describe, expect, it, vi } from "vitest";
import { runClaudeCodePrompt } from "./claudeCode.js";
import type { EventEmitter } from "node:events";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

type MockChildProcess = {
  stdout: EventEmitter & { setEncoding: (encoding: string) => void };
  stderr: EventEmitter & { setEncoding: (encoding: string) => void };
  stdin: EventEmitter & {
    end: (data: string) => void;
    on: (event: string, handler: () => void) => void;
  };
  once: (event: string, handler: (...args: unknown[]) => void) => void;
  kill: (signal: string) => void;
};

function createMockChildProcess(): MockChildProcess {
  const stdout = Object.assign(new EventTarget() as unknown as EventEmitter, {
    setEncoding: vi.fn(),
    on: vi.fn(),
  });
  const stderr = Object.assign(new EventTarget() as unknown as EventEmitter, {
    setEncoding: vi.fn(),
    on: vi.fn(),
  });
  const stdin = Object.assign(new EventTarget() as unknown as EventEmitter, {
    end: vi.fn(),
    on: vi.fn(),
  });

  const eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  return {
    stdout,
    stderr,
    stdin,
    once: (event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    },
    kill: vi.fn(),
    triggerEvent: (event: string, ...args: unknown[]) => {
      if (eventHandlers[event]) {
        for (const handler of eventHandlers[event]) {
          handler(...args);
        }
      }
    },
  } as unknown as MockChildProcess;
}

function setupSuccessfulClaude(stdout: string, stderr = "", exitCode = 0) {
  const mockChild = createMockChildProcess();
  spawnMock.mockReturnValue(mockChild);

  setTimeout(() => {
    if (stdout) {
      (mockChild.stdout.on as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.(
        stdout,
      );
    }
    if (stderr) {
      (mockChild.stderr.on as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.(
        stderr,
      );
    }
    (
      mockChild as unknown as {
        triggerEvent: (event: string, ...args: unknown[]) => void;
      }
    ).triggerEvent("close", exitCode, null);
  }, 0);

  return mockChild;
}

describe("runClaudeCodePrompt", () => {
  afterEach(() => {
    spawnMock.mockReset();
    vi.restoreAllMocks();
  });

  it("spawns claude with default arguments", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, undefined);

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      ["-p", "--output-format", "json"],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  });

  it("sends prompt to stdin", async () => {
    const mockChild = setupSuccessfulClaude(
      JSON.stringify({ type: "result", result: "ok" }),
    );

    await runClaudeCodePrompt("test prompt", 30000, undefined);

    expect(mockChild.stdin.end).toHaveBeenCalledWith("test prompt");
  });

  it("returns response from successful JSON output", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "answer" }));

    const result = await runClaudeCodePrompt("test prompt", 30000, undefined);

    expect(result).toBe("answer");
  });

  it("returns response from successful JSON output array", async () => {
    setupSuccessfulClaude(
      JSON.stringify([
        { type: "result", result: "intermediate", is_error: true },
        { type: "result", result: "final answer" },
      ]),
    );

    const result = await runClaudeCodePrompt("test prompt", 30000, undefined);

    expect(result).toBe("final answer");
  });

  it("passes model option to claude", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, { model: "sonnet-4" });

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--model", "sonnet-4"]),
      expect.anything(),
    );
  });

  it("passes permissionMode option to claude", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      permissionMode: "acceptEdits",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--permission-mode", "acceptEdits"]),
      expect.anything(),
    );
  });

  it("passes dangerouslySkipPermissions flag when true", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      dangerouslySkipPermissions: true,
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--dangerously-skip-permissions"]),
      expect.anything(),
    );
  });

  it("passes normalized maxTurns option", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, { maxTurns: 3.8 });

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--max-turns", "3"]),
      expect.anything(),
    );
  });

  it("ignores invalid maxTurns values", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      maxTurns: -1,
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--max-turns");
  });

  it("ignores maxTurns values that floor to zero", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      maxTurns: 0.5,
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--max-turns");
  });

  it("passes allowedTools string option", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      allowedTools: "Edit,Bash",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--allowedTools", "Edit,Bash"]),
      expect.anything(),
    );
  });

  it("passes normalized allowedTools array option", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      allowedTools: ["Edit", "", "Bash"],
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toEqual(
      expect.arrayContaining(["--allowedTools", "Edit", "Bash"]),
    );
  });

  it("passes normalized disallowedTools array option", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      disallowedTools: ["WebFetch", "WebSearch"],
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toEqual(
      expect.arrayContaining(["--disallowedTools", "WebFetch", "WebSearch"]),
    );
  });

  it("passes appendSystemPrompt option to claude", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      appendSystemPrompt: "Always be concise.",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--append-system-prompt", "Always be concise."]),
      expect.anything(),
    );
  });

  it("passes mcpConfig option to claude", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      mcpConfig: "./mcp.json",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--mcp-config", "./mcp.json"]),
      expect.anything(),
    );
  });

  it("uses custom working directory when provided", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result", result: "ok" }));

    await runClaudeCodePrompt("test prompt", 30000, {
      workingDirectory: "/custom/path",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "claude",
      expect.anything(),
      expect.objectContaining({ cwd: "/custom/path" }),
    );
  });

  it("throws error when claude fails to start", async () => {
    const mockChild = createMockChildProcess();
    spawnMock.mockReturnValue(mockChild);

    setTimeout(() => {
      (
        mockChild as unknown as {
          triggerEvent: (event: string, ...args: unknown[]) => void;
        }
      ).triggerEvent("error", new Error("ENOENT: claude not found"));
    }, 0);

    await expect(
      runClaudeCodePrompt("test prompt", 30000, undefined),
    ).rejects.toThrow(/Failed to start Claude Code CLI/);
  });

  it("throws timeout error when process exceeds timeout", async () => {
    const mockChild = createMockChildProcess();
    spawnMock.mockReturnValue(mockChild);

    setTimeout(() => {
      (
        mockChild as unknown as {
          triggerEvent: (event: string, ...args: unknown[]) => void;
        }
      ).triggerEvent("close", null, "SIGTERM");
    }, 50);

    const promise = runClaudeCodePrompt("test prompt", 10, undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));

    await expect(promise).rejects.toThrow("Claude Code timed out after 10ms.");
  });

  it("throws error with exit code when claude exits with non-zero code", async () => {
    setupSuccessfulClaude("", "error message", 1);

    await expect(
      runClaudeCodePrompt("test prompt", 30000, undefined),
    ).rejects.toThrow("Claude Code exited with code 1. error message");
  });

  it("throws error when output is empty", async () => {
    setupSuccessfulClaude("");

    await expect(
      runClaudeCodePrompt("test prompt", 30000, undefined),
    ).rejects.toThrow("Claude Code did not return a response.");
  });

  it("throws error when output is not valid JSON", async () => {
    setupSuccessfulClaude("not-json");

    await expect(
      runClaudeCodePrompt("test prompt", 30000, undefined),
    ).rejects.toThrow("Claude Code returned invalid JSON output.");
  });

  it("throws error when JSON marks result as error", async () => {
    setupSuccessfulClaude(
      JSON.stringify({
        type: "result",
        is_error: true,
        result: "Permission denied",
      }),
    );

    await expect(
      runClaudeCodePrompt("test prompt", 30000, undefined),
    ).rejects.toThrow(
      "Claude Code returned an error response. Permission denied",
    );
  });

  it("throws error when JSON has no final response", async () => {
    setupSuccessfulClaude(JSON.stringify({ type: "result" }));

    await expect(
      runClaudeCodePrompt("test prompt", 30000, undefined),
    ).rejects.toThrow(
      "Claude Code JSON output did not include a final response.",
    );
  });
});
