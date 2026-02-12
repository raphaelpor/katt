import { registerPendingTest } from "../context/context.js";
import { logCurrentContextExecution } from "../output/testLogging.js";
import { prompt } from "../prompt/prompt.js";
import { registerFailure } from "./matcherUtils.js";

type ClassificationOptions = {
  model?: string;
  threshold?: number;
};

const DEFAULT_THRESHOLD = 3;

function extractScore(evaluation: string): number | null {
  const match = evaluation.match(/\b([1-5])\b/);
  if (!match || !match[1]) {
    return null;
  }
  return Number(match[1]);
}

export async function toBeClassifiedAs(
  result: string,
  classification: string,
  options?: ClassificationOptions,
) {
  const startedAt = Date.now();
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;

  const evaluationPromise = prompt(
    `Classify the input by how "${classification}" it is on a scale of 1 to 5.
1 means "not ${classification}" and 5 means "very ${classification}".
Return only a single number: 1, 2, 3, 4, or 5.

Input:
---
${result}
---`,
    options?.model ? { model: options.model } : undefined,
  ).then((evaluation) => {
    const score = extractScore(evaluation);
    if (score === null) {
      registerFailure(
        `failed to classify as '${classification}'. Evaluator returned '${evaluation}'`,
      );
      return;
    }

    const message = `expected response to be classified as '${classification}' with score >= ${threshold}, got ${score}`;
    if (score < threshold) {
      registerFailure(message);
      return;
    }
    logCurrentContextExecution(
      true,
      Date.now() - startedAt,
      "toBeClassifiedAs",
    );
  });

  registerPendingTest(evaluationPromise);
  return evaluationPromise;
}
