import { afterEach, describe, expect, it, vi } from "vitest";
import { runCodexPrompt } from "./codex.js";
import type { ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";

const spawnMock = vi.fn();
const mkdtempMock = vi.fn();
const readFileMock = vi.fn();
const rmMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

vi.mock("node:fs/promises", () => ({
  mkdtemp: (...args: unknown[]) => mkdtempMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
  rm: (...args: unknown[]) => rmMock(...args),
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

function setupSuccessfulCodex(
  outputFileContent?: string,
  stdout = "",
  stderr = "",
  exitCode = 0,
) {
  mkdtempMock.mockResolvedValue("/tmp/katt-codex-test");
  rmMock.mockResolvedValue(undefined);

  if (outputFileContent !== undefined) {
    readFileMock.mockResolvedValue(outputFileContent);
  } else {
    const error = new Error("ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    readFileMock.mockRejectedValue(error);
  }

  const mockChild = createMockChildProcess();
  spawnMock.mockReturnValue(mockChild);

  // Simulate process execution
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

describe("runCodexPrompt", () => {
  afterEach(() => {
    spawnMock.mockReset();
    mkdtempMock.mockReset();
    readFileMock.mockReset();
    rmMock.mockReset();
    vi.restoreAllMocks();
  });

  it("spawns codex with correct default arguments", async () => {
    setupSuccessfulCodex("response from output file");

    await runCodexPrompt("test prompt", 30000, undefined);

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      [
        "exec",
        "--color",
        "never",
        "--output-last-message",
        "/tmp/katt-codex-test/last-message.txt",
        "-",
      ],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  });

  it("returns response from output file when it exists", async () => {
    setupSuccessfulCodex("response from output file");

    const result = await runCodexPrompt("test prompt", 30000, undefined);

    expect(result).toBe("response from output file");
    expect(readFileMock).toHaveBeenCalledWith(
      "/tmp/katt-codex-test/last-message.txt",
      "utf8",
    );
  });

  it("returns stdout when output file does not exist", async () => {
    setupSuccessfulCodex(undefined, "stdout response");

    const result = await runCodexPrompt("test prompt", 30000, undefined);

    expect(result).toBe("stdout response");
  });

  it("throws error when output file is missing and stdout is empty", async () => {
    setupSuccessfulCodex(undefined, "", "");

    await expect(
      runCodexPrompt("test prompt", 30000, undefined),
    ).rejects.toThrow("Codex did not return a response.");
  });

  it("cleans up temp directory after successful execution", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, undefined);

    expect(rmMock).toHaveBeenCalledWith("/tmp/katt-codex-test", {
      recursive: true,
      force: true,
    });
  });

  it("cleans up temp directory even when execution fails", async () => {
    setupSuccessfulCodex(undefined, "", "", 1);

    await expect(
      runCodexPrompt("test prompt", 30000, undefined),
    ).rejects.toThrow();

    expect(rmMock).toHaveBeenCalledWith("/tmp/katt-codex-test", {
      recursive: true,
      force: true,
    });
  });

  it("passes model option to codex", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, { model: "gpt-4o" });

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["--model", "gpt-4o"]),
      expect.anything(),
    );
  });

  it("passes profile option to codex", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, { profile: "default" });

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["--profile", "default"]),
      expect.anything(),
    );
  });

  it("passes sandbox option to codex", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, { sandbox: "docker" });

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["--sandbox", "docker"]),
      expect.anything(),
    );
  });

  it("passes fullAuto flag when true", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, { fullAuto: true });

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["--full-auto"]),
      expect.anything(),
    );
  });

  it("does not pass fullAuto flag when false", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, { fullAuto: false });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--full-auto");
  });

  it("passes skipGitRepoCheck flag when true", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, { skipGitRepoCheck: true });

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["--skip-git-repo-check"]),
      expect.anything(),
    );
  });

  it("passes dangerouslyBypassApprovalsAndSandbox flag when true", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      dangerouslyBypassApprovalsAndSandbox: true,
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["--dangerously-bypass-approvals-and-sandbox"]),
      expect.anything(),
    );
  });

  it("passes single config override as string", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      config: "key=value",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      expect.arrayContaining(["--config", "key=value"]),
      expect.anything(),
    );
  });

  it("passes multiple config overrides as array", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      config: ["key1=value1", "key2=value2"],
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain("--config");
    expect(args).toContain("key1=value1");
    expect(args).toContain("--config");
    expect(args).toContain("key2=value2");
  });

  it("filters out empty strings from config array", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      config: ["key1=value1", "", "key2=value2", ""],
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    const configIndices = args.reduce<number[]>((acc, arg, i) => {
      if (arg === "--config") acc.push(i);
      return acc;
    }, []);

    expect(configIndices).toHaveLength(2);
    expect(args[configIndices[0] + 1]).toBe("key1=value1");
    expect(args[configIndices[1] + 1]).toBe("key2=value2");
  });

  it("ignores invalid config values", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      config: 123 as unknown as string,
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--config");
  });

  it("ignores config when it is an object", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      config: { key: "value" } as unknown as string,
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--config");
  });

  it("ignores config when it is null or undefined", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      config: null as unknown as string,
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--config");
  });

  it("uses custom working directory when provided", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      workingDirectory: "/custom/path",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      expect.anything(),
      expect.objectContaining({ cwd: "/custom/path" }),
    );
  });

  it("sends prompt to stdin", async () => {
    const mockChild = setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, undefined);

    expect(mockChild.stdin.end).toHaveBeenCalledWith("test prompt");
  });

  it("throws error when codex fails to start", async () => {
    mkdtempMock.mockResolvedValue("/tmp/katt-codex-test");
    rmMock.mockResolvedValue(undefined);

    const mockChild = createMockChildProcess();
    spawnMock.mockReturnValue(mockChild);

    setTimeout(() => {
      (
        mockChild as unknown as {
          triggerEvent: (event: string, ...args: unknown[]) => void;
        }
      ).triggerEvent("error", new Error("ENOENT: codex not found"));
    }, 0);

    await expect(
      runCodexPrompt("test prompt", 30000, undefined),
    ).rejects.toThrow(/Failed to start Codex CLI/);
  });

  it("throws timeout error when process exceeds timeout", async () => {
    mkdtempMock.mockResolvedValue("/tmp/katt-codex-test");
    rmMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue("partial response");

    const mockChild = createMockChildProcess();
    spawnMock.mockReturnValue(mockChild);

    // Simulate timeout by not closing the process immediately
    setTimeout(() => {
      // After kill is called, trigger close
      (
        mockChild as unknown as {
          triggerEvent: (event: string, ...args: unknown[]) => void;
        }
      ).triggerEvent("close", null, "SIGTERM");
    }, 50);

    const promise = runCodexPrompt("test prompt", 10, undefined);

    // Wait for timeout to trigger
    await new Promise((resolve) => setTimeout(resolve, 20));

    await expect(promise).rejects.toThrow("Codex timed out after 10ms.");
    expect(rmMock).toHaveBeenCalled();
  });

  it("throws error with exit code when codex exits with non-zero code", async () => {
    setupSuccessfulCodex(undefined, "", "error message", 1);

    await expect(
      runCodexPrompt("test prompt", 30000, undefined),
    ).rejects.toThrow("Codex exited with code 1. error message");
  });

  it("throws error with exit code without stderr when stderr is empty", async () => {
    setupSuccessfulCodex(undefined, "", "", 127);

    await expect(
      runCodexPrompt("test prompt", 30000, undefined),
    ).rejects.toThrow("Codex exited with code 127.");
  });

  it("throws error when process exits due to signal", async () => {
    mkdtempMock.mockResolvedValue("/tmp/katt-codex-test");
    rmMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue("");

    const mockChild = createMockChildProcess();
    spawnMock.mockReturnValue(mockChild);

    setTimeout(() => {
      (
        mockChild as unknown as {
          triggerEvent: (event: string, ...args: unknown[]) => void;
        }
      ).triggerEvent("close", null, "SIGKILL");
    }, 0);

    await expect(
      runCodexPrompt("test prompt", 30000, undefined),
    ).rejects.toThrow("Codex exited due to signal SIGKILL.");
  });

  it("rethrows non-ENOENT errors when reading output file", async () => {
    mkdtempMock.mockResolvedValue("/tmp/katt-codex-test");
    rmMock.mockResolvedValue(undefined);
    readFileMock.mockRejectedValue(new Error("Permission denied"));

    const mockChild = createMockChildProcess();
    spawnMock.mockReturnValue(mockChild);

    setTimeout(() => {
      (
        mockChild as unknown as {
          triggerEvent: (event: string, ...args: unknown[]) => void;
        }
      ).triggerEvent("close", 0, null);
    }, 0);

    await expect(
      runCodexPrompt("test prompt", 30000, undefined),
    ).rejects.toThrow("Permission denied");
  });

  it("ignores invalid option values and does not pass them to codex", async () => {
    setupSuccessfulCodex("response");

    await runCodexPrompt("test prompt", 30000, {
      model: 123 as unknown as string,
      profile: null as unknown as string,
      sandbox: undefined,
    });

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain("--model");
    expect(args).not.toContain("--profile");
    expect(args).not.toContain("--sandbox");
  });
});
