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
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Suite "\u001B\[1;36msuite\u001B\[0m"$/),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Test "\u001B\[1;36mcase\u001B\[0m"\n- ✅ Passed in \u001B\[1;36m\d+ms\u001B\[0m\n---$/,
      ),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^---\n\u001B\[1;36mFiles\u001B\[0m  1 passed\n\u001B\[1;36mEvals\u001B\[0m  1 passed\n\u001B\[1;36mStart at\u001B\[0m  \d{2}:\d{2}:\d{2}\n\u001B\[1;36mDuration\u001B\[0m  \d+ms$/,
      ),
    );
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
