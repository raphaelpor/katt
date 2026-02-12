import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { findEvalFiles } from "./findEvalFiles.js";

describe("findEvalFiles", () => {
  it("returns an empty list when no eval files exist", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-find-eval-empty-"));

    const files = await findEvalFiles(tempDir);

    expect(files).toEqual([]);
  });

  it("finds eval files in nested folders and ignores non-matching files", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-find-eval-nested-"));
    const rootEval = join(tempDir, "root.eval.js");
    const nestedDir = join(tempDir, "nested");
    const nestedEval = join(nestedDir, "deep.eval.ts");
    const ignoredFile = join(nestedDir, "ignore.txt");

    await mkdir(nestedDir, { recursive: true });
    await writeFile(rootEval, 'console.log("root")', "utf8");
    await writeFile(nestedEval, 'console.log("deep")', "utf8");
    await writeFile(ignoredFile, "nope", "utf8");

    const files = await findEvalFiles(tempDir);

    expect(files.sort()).toEqual([nestedEval, rootEval].sort());
  });

  it("skips ignored directories", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-find-eval-ignore-"));
    const gitDir = join(tempDir, ".git");
    const nodeModulesDir = join(tempDir, "node_modules");
    const gitEval = join(gitDir, "ignored.eval.js");
    const nodeEval = join(nodeModulesDir, "ignored.eval.ts");
    const rootEval = join(tempDir, "root.eval.js");

    await mkdir(gitDir, { recursive: true });
    await mkdir(nodeModulesDir, { recursive: true });
    await writeFile(gitEval, 'console.log("git")', "utf8");
    await writeFile(nodeEval, 'console.log("node")', "utf8");
    await writeFile(rootEval, 'console.log("root")', "utf8");

    const files = await findEvalFiles(tempDir);

    expect(files).toEqual([rootEval]);
  });
});
