import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindEvalFiles,
  mockClearFailedTests,
  mockClearTotalTests,
  mockGetFailedTests,
  mockGetTotalTests,
  mockSettlePendingTests,
  mockEvalFileRun,
  mockResetTestLoggingState,
  mockCyanBold,
  mockDisplayBanner,
  mockSetSnapshotUpdateMode,
  mockSetKattConfigFilePath,
  mockGetIgnorePatterns,
} = vi.hoisted(() => ({
  mockFindEvalFiles: vi.fn(),
  mockClearFailedTests: vi.fn(),
  mockClearTotalTests: vi.fn(),
  mockGetFailedTests: vi.fn(),
  mockGetTotalTests: vi.fn(),
  mockSettlePendingTests: vi.fn(),
  mockEvalFileRun: vi.fn(),
  mockResetTestLoggingState: vi.fn(),
  mockCyanBold: vi.fn((value: string) => `[${value}]`),
  mockDisplayBanner: vi.fn(),
  mockSetSnapshotUpdateMode: vi.fn(),
  mockSetKattConfigFilePath: vi.fn(),
  mockGetIgnorePatterns: vi.fn(),
}));

vi.mock("./findEvalFiles.js", () => ({
  findEvalFiles: mockFindEvalFiles,
}));

vi.mock("../lib/context/context.js", () => ({
  clearFailedTests: mockClearFailedTests,
  clearTotalTests: mockClearTotalTests,
  getFailedTests: mockGetFailedTests,
  getTotalTests: mockGetTotalTests,
  settlePendingTests: mockSettlePendingTests,
}));

vi.mock("../lib/context/evalFileContext.js", () => ({
  evalFileStorage: {
    run: mockEvalFileRun,
  },
}));

vi.mock("../lib/it/it.js", () => ({
  resetTestLoggingState: mockResetTestLoggingState,
}));

vi.mock("../lib/output/color.js", () => ({
  cyanBold: mockCyanBold,
}));

vi.mock("../lib/expect/snapshotConfig.js", () => ({
  setSnapshotUpdateMode: mockSetSnapshotUpdateMode,
}));

vi.mock("../lib/config/config.js", () => ({
  setKattConfigFilePath: mockSetKattConfigFilePath,
  getIgnorePatterns: mockGetIgnorePatterns,
}));

vi.mock("./banner.js", () => ({
  displayBanner: mockDisplayBanner,
}));

import { runCli } from "./runCli.js";

describe("runCli", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T05:06:07.000Z"));

    mockFindEvalFiles.mockReset();
    mockClearFailedTests.mockReset();
    mockClearTotalTests.mockReset();
    mockGetFailedTests.mockReset();
    mockGetTotalTests.mockReset();
    mockSettlePendingTests.mockReset();
    mockEvalFileRun.mockReset();
    mockResetTestLoggingState.mockReset();
    mockCyanBold.mockClear();
    mockDisplayBanner.mockReset();
    mockSetSnapshotUpdateMode.mockReset();
    mockSetKattConfigFilePath.mockReset();
    mockGetIgnorePatterns.mockReset();

    mockGetFailedTests.mockReturnValue([]);
    mockGetTotalTests.mockReturnValue(0);
    mockSettlePendingTests.mockResolvedValue([]);
    mockGetIgnorePatterns.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns 1 when no eval files are found", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockFindEvalFiles.mockResolvedValue([]);

    const exitCode = await runCli();

    expect(exitCode).toBe(1);
    expect(mockDisplayBanner).toHaveBeenCalledTimes(1);
    expect(mockResetTestLoggingState).toHaveBeenCalledTimes(1);
    expect(mockClearFailedTests).toHaveBeenCalledTimes(1);
    expect(mockClearTotalTests).toHaveBeenCalledTimes(1);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockGetIgnorePatterns).toHaveBeenCalledTimes(1);
    expect(mockSetSnapshotUpdateMode).toHaveBeenCalledWith(false);
    expect(logSpy).toHaveBeenCalledWith("No .eval.js or .eval.ts files found.");
  });

  it("returns 0 and prints help when --help is passed", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const originalArgv = process.argv;
    let exitCode = 1;
    try {
      process.argv = ["node", "katt", "--help"];
      exitCode = await runCli();
    } finally {
      process.argv = originalArgv;
    }

    expect(exitCode).toBe(0);
    expect(mockDisplayBanner).toHaveBeenCalledTimes(1);
    expect(mockSetSnapshotUpdateMode).not.toHaveBeenCalled();
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockFindEvalFiles).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("-h, --help"));
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("--config-file PATH"),
    );
  });

  it("returns 0 and prints help when -h is passed", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const originalArgv = process.argv;
    let exitCode = 1;
    try {
      process.argv = ["node", "katt", "-h"];
      exitCode = await runCli();
    } finally {
      process.argv = originalArgv;
    }

    expect(exitCode).toBe(0);
    expect(mockDisplayBanner).toHaveBeenCalledTimes(1);
    expect(mockSetSnapshotUpdateMode).not.toHaveBeenCalled();
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockFindEvalFiles).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("enables snapshot update mode when -u is passed", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockFindEvalFiles.mockResolvedValue(["/tmp/a.eval.ts"]);
    mockEvalFileRun.mockResolvedValue(undefined);

    const originalArgv = process.argv;
    let exitCode = 1;
    try {
      process.argv = ["node", "katt", "-u"];
      exitCode = await runCli();
    } finally {
      process.argv = originalArgv;
    }

    expect(exitCode).toBe(0);
    expect(mockSetSnapshotUpdateMode).toHaveBeenCalledWith(true);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockGetIgnorePatterns).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalled();
  });

  it("uses custom config file from --config-file", async () => {
    mockFindEvalFiles.mockResolvedValue(["/tmp/a.eval.ts"]);
    mockEvalFileRun.mockResolvedValue(undefined);
    const originalArgv = process.argv;
    let exitCode = 1;

    try {
      process.argv = ["node", "katt", "--config-file", "./custom.json"];
      exitCode = await runCli();
    } finally {
      process.argv = originalArgv;
    }

    expect(exitCode).toBe(0);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith("./custom.json");
    expect(mockGetIgnorePatterns).toHaveBeenCalledTimes(1);
  });

  it("uses custom config file from --config-file=<path>", async () => {
    mockFindEvalFiles.mockResolvedValue(["/tmp/a.eval.ts"]);
    mockEvalFileRun.mockResolvedValue(undefined);
    const originalArgv = process.argv;
    let exitCode = 1;

    try {
      process.argv = ["node", "katt", "--config-file=./custom.json"];
      exitCode = await runCli();
    } finally {
      process.argv = originalArgv;
    }

    expect(exitCode).toBe(0);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith("./custom.json");
    expect(mockGetIgnorePatterns).toHaveBeenCalledTimes(1);
  });

  it("returns 1 when --config-file is provided without value", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalArgv = process.argv;
    let exitCode = 0;

    try {
      process.argv = ["node", "katt", "--config-file"];
      exitCode = await runCli();
    } finally {
      process.argv = originalArgv;
    }

    expect(exitCode).toBe(1);
    expect(mockDisplayBanner).toHaveBeenCalledTimes(1);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockSetSnapshotUpdateMode).not.toHaveBeenCalled();
    expect(mockFindEvalFiles).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("Missing value for --config-file.");
  });

  it("returns 1 when an eval file execution fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFindEvalFiles.mockResolvedValue(["/tmp/a.eval.ts"]);
    mockEvalFileRun.mockRejectedValue(new Error("boom"));

    const exitCode = await runCli();

    expect(exitCode).toBe(1);
    expect(mockDisplayBanner).toHaveBeenCalledTimes(1);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockGetIgnorePatterns).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error executing /tmp/a.eval.ts: Error: boom"),
    );
  });

  it("returns 1 when pending async tests fail", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFindEvalFiles.mockResolvedValue(["/tmp/a.eval.ts"]);
    mockEvalFileRun.mockResolvedValue(undefined);
    mockSettlePendingTests.mockResolvedValue([
      {
        status: "rejected",
        reason: new Error("async boom"),
      },
    ]);

    const exitCode = await runCli();

    expect(exitCode).toBe(1);
    expect(mockDisplayBanner).toHaveBeenCalledTimes(1);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockGetIgnorePatterns).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error executing async test: Error: async boom"),
    );
  });

  it("returns 1 and prints failed test details when failures are registered", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFindEvalFiles.mockResolvedValue(["/tmp/a.eval.ts"]);
    mockEvalFileRun.mockResolvedValue(undefined);
    mockGetFailedTests.mockReturnValue([
      {
        describePath: "suite > nested",
        itPath: "case",
        message: "expected x to include y",
      },
    ]);

    const exitCode = await runCli();

    expect(exitCode).toBe(1);
    expect(mockDisplayBanner).toHaveBeenCalledTimes(1);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockGetIgnorePatterns).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("❌ Failed tests:");
    expect(errorSpy).toHaveBeenCalledWith(
      "1. suite > nested > case: expected x to include y",
    );
  });

  it("returns 0 and logs summary on success", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockFindEvalFiles.mockResolvedValue(["/tmp/a.eval.ts", "/tmp/b.eval.ts"]);
    mockEvalFileRun.mockResolvedValue(undefined);
    mockGetTotalTests.mockReturnValue(3);

    const exitCode = await runCli();

    expect(exitCode).toBe(0);
    expect(mockDisplayBanner).toHaveBeenCalledTimes(1);
    expect(mockSetKattConfigFilePath).toHaveBeenCalledWith(undefined);
    expect(mockGetIgnorePatterns).toHaveBeenCalledTimes(1);
    expect(mockEvalFileRun).toHaveBeenCalledTimes(2);
    expect(mockEvalFileRun).toHaveBeenNthCalledWith(
      1,
      { evalFile: "/tmp/a.eval.ts" },
      expect.any(Function),
    );
    expect(logSpy).toHaveBeenCalledTimes(1);
    const summary = logSpy.mock.calls[0]?.[0] ?? "";
    expect(summary).toContain("[Files]  2 passed");
    expect(summary).toContain("[Evals]  3 passed");
    expect(summary).toMatch(/\[Start at\]\s+\d{2}:\d{2}:\d{2}/);
    expect(summary).toContain("[Duration]");
  });

  it("passes config ignore patterns to eval file discovery", async () => {
    mockGetIgnorePatterns.mockResolvedValue(["/tmp/ignore/**"]);
    mockFindEvalFiles.mockResolvedValue(["/tmp/a.eval.ts"]);
    mockEvalFileRun.mockResolvedValue(undefined);

    const exitCode = await runCli();

    expect(exitCode).toBe(0);
    expect(mockFindEvalFiles).toHaveBeenCalledWith(process.cwd(), [
      "/tmp/ignore/**",
    ]);
  });
});
