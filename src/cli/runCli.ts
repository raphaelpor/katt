import { pathToFileURL } from "node:url";
import { findEvalFiles } from "./findEvalFiles.js";
import {
  clearTotalTests,
  clearFailedTests,
  getFailedTests,
  getTotalTests,
  settlePendingTests,
} from "../lib/context/context.js";
import { resetTestLoggingState } from "../lib/it/it.js";
import { evalFileStorage } from "../lib/context/evalFileContext.js";
import { cyanBold } from "../lib/output/color.js";
import { displayBanner } from "./banner.js";
import { setSnapshotUpdateMode } from "../lib/expect/snapshotConfig.js";
import { setKattConfigFilePath } from "../lib/config/config.js";

function formatStartTime(startTime: Date): string {
  const hours = String(startTime.getHours()).padStart(2, "0");
  const minutes = String(startTime.getMinutes()).padStart(2, "0");
  const seconds = String(startTime.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function displayHelp(): void {
  console.log(
    [
      "Usage:",
      "  katt [options]",
      "",
      "Options:",
      "  -h, --help              Show CLI usage information",
      "  -u, --update-snapshots  Update snapshot files on mismatch",
      "      --config-file PATH  Use a custom config file instead of katt.json",
    ].join("\n"),
  );
}

type ParsedCliConfigFile = {
  configFilePath?: string;
  error?: string;
};

function parseConfigFilePath(args: string[]): ParsedCliConfigFile {
  let configFilePath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--config-file") {
      const value = args[index + 1];
      if (value === undefined || value.length === 0) {
        return { error: "Missing value for --config-file." };
      }
      configFilePath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--config-file=")) {
      const value = arg.slice("--config-file=".length);
      if (value.length === 0) {
        return { error: "Missing value for --config-file." };
      }
      configFilePath = value;
    }
  }

  return { configFilePath };
}

export async function runCli(): Promise<number> {
  const args = process.argv.slice(2);
  setKattConfigFilePath(undefined);
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  if (shouldShowHelp) {
    displayBanner();
    displayHelp();
    return 0;
  }

  const parsedConfigFile = parseConfigFilePath(args);
  if (parsedConfigFile.error) {
    displayBanner();
    console.error(parsedConfigFile.error);
    return 1;
  }
  setKattConfigFilePath(parsedConfigFile.configFilePath);

  const shouldUpdateSnapshots =
    args.includes("--update-snapshots") || args.includes("-u");
  setSnapshotUpdateMode(shouldUpdateSnapshots);

  displayBanner();
  const startTime = new Date();
  resetTestLoggingState();
  clearFailedTests();
  clearTotalTests();
  const evalFiles = await findEvalFiles(process.cwd());

  if (evalFiles.length === 0) {
    console.log("No .eval.js or .eval.ts files found.");
    return 1;
  }

  const results = await Promise.allSettled(
    evalFiles.map((file) =>
      evalFileStorage.run(
        { evalFile: file },
        () => import(pathToFileURL(file).href),
      ),
    ),
  );

  const failures = results
    .map((result, index) => ({ result, file: evalFiles[index] }))
    .filter(({ result }) => result.status === "rejected");

  if (failures.length > 0) {
    for (const failure of failures) {
      const reason =
        failure.result.status === "rejected"
          ? failure.result.reason
          : undefined;
      console.error(`Error executing ${failure.file}: ${String(reason)}`);
    }
    return 1;
  }

  const pendingResults = await settlePendingTests();
  const pendingFailures = pendingResults.filter(
    (result) => result.status === "rejected",
  );
  if (pendingFailures.length > 0) {
    for (const failure of pendingFailures) {
      if (failure.status === "rejected") {
        console.error(`Error executing async test: ${String(failure.reason)}`);
      }
    }
    return 1;
  }

  const failedTests = getFailedTests();
  if (failedTests.length > 0) {
    console.error("❌ Failed tests:");
    for (const [index, failure] of failedTests.entries()) {
      const path = [failure.describePath, failure.itPath]
        .filter((part) => part.length > 0)
        .join(" > ");
      const pathPrefix = path.length > 0 ? `${path}: ` : "";
      console.error(`${index + 1}. ${pathPrefix}${failure.message}`);
    }
    return 1;
  }

  const totalTests = getTotalTests();
  const durationMs = Date.now() - startTime.getTime();
  console.log(
    [
      "---",
      `${cyanBold("Files")}  ${evalFiles.length} passed`,
      `${cyanBold("Evals")}  ${totalTests} passed`,
      `${cyanBold("Start at")}  ${formatStartTime(startTime)}`,
      `${cyanBold("Duration")}  ${durationMs}ms`,
    ].join("\n"),
  );

  return 0;
}
