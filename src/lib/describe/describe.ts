import type { TestCallback } from "../test-types/test-types.js";
import {
  createChildContext,
  popDescribe,
  pushDescribe,
  registerPendingTest,
  runWithContext,
} from "../context/context.js";

export function describe(description: string, fn: TestCallback): void {
  runWithContext(() => {
    pushDescribe(description);
    try {
      const result = fn();
      if (result && typeof (result as Promise<void>).then === "function") {
        registerPendingTest(
          (result as Promise<void>).finally(() => {
            popDescribe();
          }),
        );
        return;
      }
    } catch (err) {
      popDescribe();
      throw err;
    }
    popDescribe();
  }, createChildContext());
}
