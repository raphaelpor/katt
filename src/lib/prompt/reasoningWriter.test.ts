import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pushDescribe,
  pushIt,
  resetDescribeContext,
  resetItContext,
} from "../context/context.js";
import { evalFileStorage } from "../context/evalFileContext.js";
import {
  NO_FINAL_OUTPUT_PLACEHOLDER,
  NO_REASONING_PLACEHOLDER,
  saveReasoningTrace,
} from "./reasoningWriter.js";

describe("saveReasoningTrace", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetDescribeContext();
    resetItContext();
  });

  it("creates a reasoning file using eval and context path segments", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-reasoning-create-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const expectedPath = join(
      tempDir,
      "__reasoning__",
      "greeting__Greeting_agent__should_say_hello.reasoning.md",
    );

    const actualPath = await evalFileStorage.run(
      { evalFile: evalFilePath },
      async () => {
        pushDescribe("Greeting agent");
        pushIt("should say hello");
        return saveReasoningTrace("codex", "step 1", "hello");
      },
    );

    expect(actualPath).toBe(expectedPath);
    const content = await readFile(expectedPath, "utf8");
    expect(content).toContain("# Reasoning");
    expect(content).toContain("Runtime: codex");
    expect(content).toContain("## Reasoning Trace");
    expect(content).toContain("step 1");
    expect(content).toContain("## Final Output");
    expect(content).toContain("hello");
  });

  it("uses root when there is no describe/it context", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-reasoning-root-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const expectedPath = join(
      tempDir,
      "__reasoning__",
      "greeting__root.reasoning.md",
    );

    const actualPath = await evalFileStorage.run(
      { evalFile: evalFilePath },
      async () => saveReasoningTrace("gh-copilot", "reasoning text", "hi"),
    );

    expect(actualPath).toBe(expectedPath);
    expect(await readFile(expectedPath, "utf8")).toContain(
      "Runtime: gh-copilot",
    );
  });

  it("appends a UTC timestamp when the default reasoning file already exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:00.000Z"));

    const tempDir = await mkdtemp(join(tmpdir(), "katt-reasoning-timestamp-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const reasoningDir = join(tempDir, "__reasoning__");
    const basePath = join(reasoningDir, "greeting__root.reasoning.md");
    const timestampedPath = join(
      reasoningDir,
      "greeting__root__20240601T120000.reasoning.md",
    );

    await mkdir(reasoningDir, { recursive: true });
    await writeFile(basePath, "existing", "utf8");

    const actualPath = await evalFileStorage.run(
      { evalFile: evalFilePath },
      async () => saveReasoningTrace("codex", "new reasoning", "new output"),
    );

    expect(actualPath).toBe(timestampedPath);
    expect(await readFile(basePath, "utf8")).toBe("existing");
    expect(await readFile(timestampedPath, "utf8")).toContain("new reasoning");
  });

  it("sanitizes invalid path characters the same as snapshot naming", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-reasoning-sanitize-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const expectedPath = join(
      tempDir,
      "__reasoning__",
      "greeting__Greeting_agent__should_say_hello.reasoning.md",
    );

    const actualPath = await evalFileStorage.run(
      { evalFile: evalFilePath },
      async () => {
        pushDescribe("Greeting/agent");
        pushIt("should:say*hello");
        return saveReasoningTrace("codex", "reasoning", "output");
      },
    );

    expect(actualPath).toBe(expectedPath);
  });

  it("writes a placeholder when reasoning content is empty", async () => {
    const tempDir = await mkdtemp(
      join(tmpdir(), "katt-reasoning-placeholder-"),
    );
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const expectedPath = join(
      tempDir,
      "__reasoning__",
      "greeting__root.reasoning.md",
    );

    await evalFileStorage.run({ evalFile: evalFilePath }, async () => {
      await saveReasoningTrace("codex", "   ", "final output");
    });

    expect(await readFile(expectedPath, "utf8")).toContain(
      NO_REASONING_PLACEHOLDER,
    );
  });

  it("writes a placeholder when final output content is empty", async () => {
    const tempDir = await mkdtemp(
      join(tmpdir(), "katt-reasoning-output-placeholder-"),
    );
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const expectedPath = join(
      tempDir,
      "__reasoning__",
      "greeting__root.reasoning.md",
    );

    await evalFileStorage.run({ evalFile: evalFilePath }, async () => {
      await saveReasoningTrace("codex", "reasoning", "   ");
    });

    expect(await readFile(expectedPath, "utf8")).toContain(
      NO_FINAL_OUTPUT_PLACEHOLDER,
    );
  });

  it("does nothing outside eval file context", async () => {
    await expect(
      saveReasoningTrace("codex", "reasoning", "output"),
    ).resolves.toBeUndefined();
  });
});
