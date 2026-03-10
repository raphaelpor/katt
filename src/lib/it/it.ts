import type { TestCallback } from "../test-types/test-types.js";
import {
  createChildContext,
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
    const startedAt = Date.now();
    const elapsed = () => Date.now() - startedAt;

    try {
      const result = fn();
      if (result && typeof (result as Promise<void>).then === "function") {
        registerPendingTest(
          (result as Promise<void>)
            .then(() => {
              logCurrentContextExecution(elapsed());
            })
            .catch((err: unknown) => {
              logCurrentContextExecution(elapsed());
              throw err;
            })
            .finally(() => {
              popIt();
            }),
        );
        return;
      }
    } catch (err) {
      logCurrentContextExecution(elapsed());
      popIt();
      throw err;
    }

    logCurrentContextExecution(elapsed());
    popIt();
  }, createChildContext());
}
