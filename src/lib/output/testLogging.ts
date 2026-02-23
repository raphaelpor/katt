import {
  getCurrentTestModel,
  getCurrentTestTokenUsage,
  getDescribePath,
  getItPath,
} from "../context/context.js";
import { cyanBold } from "./color.js";

let lastLoggedSuite = "";

export function resetTestLoggingState(): void {
  lastLoggedSuite = "";
}

type TestLogOptions = {
  suitePath: string;
  casePath: string;
  durationMs: number;
  model?: string;
  tokenUsage?: number;
};

export function logTestExecution({
  suitePath,
  casePath,
  durationMs,
  model,
  tokenUsage,
}: TestLogOptions): void {
  const suiteLabel = suitePath.length > 0 ? suitePath : "(root)";
  const caseLabel = casePath.length > 0 ? casePath : "(root)";

  if (lastLoggedSuite !== suiteLabel) {
    console.log(`Suite "${cyanBold(suiteLabel)}"`);
    lastLoggedSuite = suiteLabel;
  }

  const lines = [
    `Test "${cyanBold(caseLabel)}"`,
    `- Finished in ${cyanBold(`${durationMs} ms`)}`,
  ];

  if (model) {
    lines.push(`- Model ${cyanBold(model)}`);
  }

  if ((tokenUsage ?? 0) > 0) {
    lines.push(`- Tokens used ${cyanBold(String(tokenUsage))}`);
  }

  lines.push("---");
  console.log(lines.join("\n"));
}

export function logCurrentContextExecution(
  durationMs: number,
  fallbackCasePath = "(root)",
): void {
  const casePath = getItPath();
  logTestExecution({
    suitePath: getDescribePath(),
    casePath: casePath.length > 0 ? casePath : fallbackCasePath,
    durationMs,
    model: getCurrentTestModel(),
    tokenUsage: getCurrentTestTokenUsage(),
  });
}
