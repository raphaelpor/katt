import { registerPendingTest } from "../context/context.js";
import { logCurrentContextExecution } from "../output/testLogging.js";
import { prompt } from "../prompt/prompt.js";
import { registerFailure } from "./matcherUtils.js";

export async function promptCheck(result: string, instructions: string) {
  const startedAt = Date.now();
  const message = `expected '${result}' to satisfy '${instructions}'`;

  const evaluationPromise =
    prompt(`Evaluate if the expectation is fulfiled in by the input.
        Expectation: "${instructions}".
        Input:
        ---
        ${result}
        ---
        Important: Answer with "Yes" or "No" only, without any additional text.
        `).then((evaluation) => {
      if (evaluation.includes("Yes")) {
        logCurrentContextExecution(true, Date.now() - startedAt, "promptCheck");
      } else if (evaluation.includes("No")) {
        registerFailure(message);
      } else {
        registerFailure(`failed to evaluate expectation '${instructions}'`);
      }
    });

  registerPendingTest(evaluationPromise);
  return evaluationPromise;
}
