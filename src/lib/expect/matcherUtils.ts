import {
  getDescribePath,
  getItPath,
  registerFailedTest,
} from "../context/context.js";

export function registerFailure(message: string) {
  registerFailedTest({
    describePath: getDescribePath(),
    itPath: getItPath(),
    message,
  });
}
