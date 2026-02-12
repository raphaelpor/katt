import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { evalFileStorage } from "../context/evalFileContext.js";
import { registerFailure } from "./matcherUtils.js";
import { getSnapshotUpdateMode } from "./snapshotConfig.js";

function resolveSnapshotFilePath(evalFilePath: string): string {
  const evalFileName = basename(evalFilePath);
  const snapshotBaseName = evalFileName.replace(/\.eval\.[^./\\]+$/, "");
  return join(
    dirname(evalFilePath),
    "__snapshots__",
    `${snapshotBaseName}.snap.md`,
  );
}

function toLines(value: string): string[] {
  return value.split(/\r?\n/);
}

function createDiff(expected: string, received: string): string {
  if (expected === received) {
    return "  (no diff)";
  }

  const expectedLines = toLines(expected);
  const receivedLines = toLines(received);
  const maxLines = Math.max(expectedLines.length, receivedLines.length);
  const diffLines: string[] = [];

  for (let index = 0; index < maxLines; index += 1) {
    const expectedLine = expectedLines[index];
    const receivedLine = receivedLines[index];

    if (expectedLine === receivedLine) {
      continue;
    }
    if (expectedLine === undefined && receivedLine !== undefined) {
      diffLines.push(`+ ${receivedLine}`);
      continue;
    }
    if (expectedLine !== undefined && receivedLine === undefined) {
      diffLines.push(`- ${expectedLine}`);
      continue;
    }

    diffLines.push(`- ${expectedLine ?? ""}`);
    diffLines.push(`+ ${receivedLine ?? ""}`);
  }

  return diffLines.join("\n");
}

export function toMatchSnapshot(result: string): void {
  const evalFile = evalFileStorage.getStore()?.evalFile;

  if (!evalFile) {
    registerFailure(
      "toMatchSnapshot can only be used while running an eval file.",
    );
    return;
  }

  const snapshotFilePath = resolveSnapshotFilePath(evalFile);

  try {
    const expectedSnapshot = readFileSync(snapshotFilePath, "utf8");
    if (expectedSnapshot === result) {
      return;
    }

    if (getSnapshotUpdateMode()) {
      writeFileSync(snapshotFilePath, result, "utf8");
      return;
    }

    const diff = createDiff(expectedSnapshot, result);
    registerFailure(
      [
        `Snapshot mismatch at ${snapshotFilePath}`,
        "",
        "Diff:",
        diff,
        "",
        "Run katt with --update-snapshots (or -u) to accept this change.",
      ].join("\n"),
    );
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode !== "ENOENT") {
      registerFailure(
        `Failed to read snapshot at ${snapshotFilePath}: ${String(error)}`,
      );
      return;
    }

    try {
      mkdirSync(dirname(snapshotFilePath), { recursive: true });
      writeFileSync(snapshotFilePath, result, "utf8");
    } catch (writeError) {
      registerFailure(
        `Failed to write snapshot at ${snapshotFilePath}: ${String(writeError)}`,
      );
    }
  }
}
