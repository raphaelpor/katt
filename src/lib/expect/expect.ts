import { promptCheck } from "./promptCheck.js";
import { toBeClassifiedAs } from "./toBeClassifiedAs.js";
import { toContain } from "./toContain.js";
import { toMatchSnapshot } from "./toMatchSnapshot.js";

export function expect(result: string) {
  return {
    toContain: (expected: string) => {
      toContain(result, expected);
    },
    toMatchSnapshot: () => {
      toMatchSnapshot(result);
    },
    promptCheck: async (instructions: string) => {
      await promptCheck(result, instructions);
    },
    toBeClassifiedAs: async (
      classification: string,
      options?: { model?: string; threshold?: number },
    ) => {
      await toBeClassifiedAs(result, classification, options);
    },
  };
}
