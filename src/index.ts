import { describe } from "./lib/describe/describe.js";
import { expect } from "./lib/expect/expect.js";
import { it } from "./lib/it/it.js";
import { prompt, promptFile } from "./lib/prompt/prompt.js";
import { runCli } from "./cli/runCli.js";

Object.assign(globalThis, { describe, it, expect, prompt, promptFile });

runCli()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((err) => {
    console.error(`Unexpected error: ${String(err)}`);
    process.exit(1);
  });

export { runCli };
