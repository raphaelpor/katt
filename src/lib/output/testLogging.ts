import {
  getCurrentTestModel,
  getCurrentTestTokenUsage,
  getDescribePath,
  getItPath,
} from "../context/context.js";
import { cyanBold } from "./color.js";

const loggedSuites = new Set<string>();

export function resetTestLoggingState(): void {
  loggedSuites.clear();
}

type TestLogOptions = {
  suitePath: string;
  casePath: string;
  didPass: boolean;
  durationMs: number;
  model?: string;
  tokenUsage?: number;
};

export function logTestExecution({
  suitePath,
  casePath,
  didPass,
  durationMs,
  model,
  tokenUsage,
}: TestLogOptions): void {
  const suiteLabel = suitePath.length > 0 ? suitePath : "(root)";
  const caseLabel = casePath.length > 0 ? casePath : "(root)";

  if (!loggedSuites.has(suiteLabel)) {
    console.log(`Suite "${cyanBold(suiteLabel)}"`);
    loggedSuites.add(suiteLabel);
  }

  const outcome = didPass ? "✅ Passed in" : "❌ Failed in";
  const lines = [
    `Test "${cyanBold(caseLabel)}"`,
    `- ${outcome} ${cyanBold(`${durationMs}ms`)}`,
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
  didPass: boolean,
  durationMs: number,
  fallbackCasePath = "(root)",
): void {
  const casePath = getItPath();
  logTestExecution({
    suitePath: getDescribePath(),
    casePath: casePath.length > 0 ? casePath : fallbackCasePath,
    didPass,
    durationMs,
    model: getCurrentTestModel(),
    tokenUsage: getCurrentTestTokenUsage(),
  });
}
