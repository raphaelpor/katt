import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { runCli } from "./cli/runCli.js";
import { describe as describeFn } from "./lib/describe/describe.js";
import { expect as expectFn } from "./lib/expect/expect.js";
import { it as itFn } from "./lib/it/it.js";
import { stripAnsi } from "./lib/output/stripAnsi.js";
import {
  resetDescribeContext,
  resetItContext,
  settlePendingTests,
} from "./lib/context/context.js";

describe("runCli", () => {
  const originalCwd = process.cwd();

  beforeAll(() => {
    Object.assign(globalThis, {
      describe: describeFn,
      it: itFn,
      expect: expectFn,
    });
  });

  beforeEach(() => {
    resetDescribeContext();
    resetItContext();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await settlePendingTests();
    vi.restoreAllMocks();
  });

  it("returns exit code 1 when no eval files exist", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-no-eval-"));
    process.chdir(tempDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const exitCode = await runCli();

    expect(exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalledWith("No .eval.js or .eval.ts files found.");
  });

  it("executes eval files and returns exit code 0", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-eval-ok-"));
    const evalFile = join(tempDir, "sample.eval.js");
    await writeFile(
      evalFile,
      [
        "globalThis.__kattExecuted = (globalThis.__kattExecuted ?? 0) + 1;",
        "describe('suite', () => {",
        "  it('case', () => {",
        "    expect('ok');",
        "  });",
        "});",
      ].join("\n"),
      "utf8",
    );

    process.chdir(tempDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitCode = await runCli();

    const globalState = globalThis as typeof globalThis & {
      __kattExecuted?: number;
    };

    expect(exitCode).toBe(0);
    expect(globalState.__kattExecuted).toBe(1);
    expect(logSpy).toHaveBeenCalledTimes(4);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("██╗  ██╗"));
    const strippedLogCalls = logSpy.mock.calls
      .map(([value]) => (typeof value === "string" ? stripAnsi(value) : null))
      .filter((value): value is string => value !== null);
    expect(strippedLogCalls).toContain('Suite "suite"');
    expect(
      strippedLogCalls.some((value) =>
        /^Test "case"\n- Finished in \d+ ms\n---$/.test(value),
      ),
    ).toBe(true);
    expect(
      strippedLogCalls.some((value) =>
        /^---\nFiles\s+1 passed\nEvals\s+1 passed\nStart at\s+\d{2}:\d{2}:\d{2}\nDuration\s+\d+ms$/.test(
          value,
        ),
      ),
    ).toBe(true);
  });

  it("returns exit code 1 when an eval file throws", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-eval-fail-"));
    const evalFile = join(tempDir, "boom.eval.js");
    await writeFile(evalFile, 'throw new Error("boom");', "utf8");

    process.chdir(tempDir);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitCode = await runCli();

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain(evalFile);
  });

  it("lists failed tests at the end of execution", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-eval-test-fail-"));
    const evalFile = join(tempDir, "failed.eval.js");
    await writeFile(
      evalFile,
      [
        "describe('suite', () => {",
        "  it('case', () => {",
        "    expect('value').toContain('missing');",
        "  });",
        "});",
      ].join("\n"),
      "utf8",
    );

    process.chdir(tempDir);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitCode = await runCli();

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("❌ Failed tests:");
    expect(errorSpy).toHaveBeenCalledWith(
      "1. suite > case: expected 'value' to include 'missing'",
    );
  });
});
