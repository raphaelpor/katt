import { registerFailure } from "./matcherUtils.js";

export function toContain(result: string, expected: string) {
  const message = `expected '${result}' to include '${expected}'`;

  if (!result.includes(expected)) {
    registerFailure(message);
  }
}
