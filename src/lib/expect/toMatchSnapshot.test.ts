import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearFailedTests,
  getFailedTests,
  pushDescribe,
  pushIt,
  resetDescribeContext,
  resetItContext,
} from "../context/context.js";
import { evalFileStorage } from "../context/evalFileContext.js";
import { setSnapshotUpdateMode } from "./snapshotConfig.js";
import { toMatchSnapshot } from "./toMatchSnapshot.js";

describe("toMatchSnapshot", () => {
  afterEach(() => {
    resetDescribeContext();
    resetItContext();
    clearFailedTests();
    setSnapshotUpdateMode(false);
  });

  it("creates a snapshot when no snapshot file exists", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-snapshot-create-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const snapshotPath = join(
      tempDir,
      "__snapshots__",
      "greeting__root.snap.md",
    );

    await evalFileStorage.run({ evalFile: evalFilePath }, () => {
      toMatchSnapshot("hello world");
    });

    expect(await readFile(snapshotPath, "utf8")).toBe("hello world");
    expect(getFailedTests()).toEqual([]);
  });

  it("passes when the snapshot matches the current value", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-snapshot-match-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const snapshotPath = join(
      tempDir,
      "__snapshots__",
      "greeting__root.snap.md",
    );

    await mkdir(join(tempDir, "__snapshots__"), { recursive: true });
    await writeFile(snapshotPath, "hello world", "utf8");

    await evalFileStorage.run({ evalFile: evalFilePath }, () => {
      toMatchSnapshot("hello world");
    });

    expect(getFailedTests()).toEqual([]);
  });

  it("registers a failure with a diff when snapshot does not match", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-snapshot-mismatch-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const snapshotPath = join(
      tempDir,
      "__snapshots__",
      "greeting__root.snap.md",
    );

    await mkdir(join(tempDir, "__snapshots__"), { recursive: true });
    await writeFile(snapshotPath, "hello\nthere", "utf8");

    await evalFileStorage.run({ evalFile: evalFilePath }, () => {
      toMatchSnapshot("hello\nworld");
    });

    expect(getFailedTests()).toEqual([
      {
        describePath: "",
        itPath: "",
        message: [
          `Snapshot mismatch at ${snapshotPath}`,
          "",
          "Diff:",
          "- there",
          "+ world",
          "",
          "Run 'npx katt --update-snapshots' (or -u) to accept this change.",
        ].join("\n"),
      },
    ]);
  });

  it("updates snapshot content when snapshot update mode is enabled", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-snapshot-update-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const snapshotPath = join(
      tempDir,
      "__snapshots__",
      "greeting__root.snap.md",
    );

    await mkdir(join(tempDir, "__snapshots__"), { recursive: true });
    await writeFile(snapshotPath, "old value", "utf8");
    setSnapshotUpdateMode(true);

    await evalFileStorage.run({ evalFile: evalFilePath }, () => {
      toMatchSnapshot("new value");
    });

    expect(await readFile(snapshotPath, "utf8")).toBe("new value");
    expect(getFailedTests()).toEqual([]);
  });

  it("registers a failure when called outside eval file execution", () => {
    toMatchSnapshot("value");

    expect(getFailedTests()).toEqual([
      {
        describePath: "",
        itPath: "",
        message: "toMatchSnapshot can only be used while running an eval file.",
      },
    ]);
  });

  it("uses describe and it context to create a unique snapshot file per test", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "katt-snapshot-context-"));
    const evalFilePath = join(tempDir, "greeting.eval.ts");
    const firstSnapshotPath = join(
      tempDir,
      "__snapshots__",
      "greeting__top_suite__first_case.snap.md",
    );
    const secondSnapshotPath = join(
      tempDir,
      "__snapshots__",
      "greeting__top_suite__second_case.snap.md",
    );

    await evalFileStorage.run({ evalFile: evalFilePath }, () => {
      pushDescribe("top suite");
      pushIt("first case");
      toMatchSnapshot("first value");
      resetItContext();

      pushIt("second case");
      toMatchSnapshot("second value");
    });

    expect(await readFile(firstSnapshotPath, "utf8")).toBe("first value");
    expect(await readFile(secondSnapshotPath, "utf8")).toBe("second value");
    expect(getFailedTests()).toEqual([]);
  });
});
