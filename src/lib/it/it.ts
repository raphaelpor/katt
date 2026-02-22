import type { TestCallback } from "../test-types/test-types.js";
import {
  createChildContext,
  getFailedTestCount,
  registerTest,
  popIt,
  pushIt,
  registerPendingTest,
  runWithContext,
} from "../context/context.js";
import {
  logCurrentContextExecution,
  resetTestLoggingState,
} from "../output/testLogging.js";

export { resetTestLoggingState };

export function it(description: string, fn: TestCallback): void {
  runWithContext(() => {
    registerTest();
    pushIt(description);
    const failedCountBefore = getFailedTestCount();
    const startedAt = Date.now();

    const didPass = () => getFailedTestCount() === failedCountBefore;
    const elapsed = () => Date.now() - startedAt;

    try {
      const result = fn();
      if (result && typeof (result as Promise<void>).then === "function") {
        registerPendingTest(
          (result as Promise<void>)
            .then(() => {
              logCurrentContextExecution(didPass(), elapsed());
            })
            .catch((err: unknown) => {
              logCurrentContextExecution(false, elapsed());
              throw err;
            })
            .finally(() => {
              popIt();
            }),
        );
        return;
      }
    } catch (err) {
      logCurrentContextExecution(false, elapsed());
      popIt();
      throw err;
    }

    logCurrentContextExecution(didPass(), elapsed());
    popIt();
  }, createChildContext());
}
