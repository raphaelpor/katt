import { runCli } from "./cli/runCli.js";

runCli()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((err) => {
    console.error(`Unexpected error: ${String(err)}`);
    process.exit(1);
  });
