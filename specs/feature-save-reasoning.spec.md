# Feature: Save Reasoning

When running `npx katt` the user should be able to call it with an option `--save-reasoning` to save the reasoning steps of the agent's execution.

Example:

```bash
npx katt --save-reasoning
```

## Expected Behavior

When the `--save-reasoning` option is used, the reasoning steps of the agent's execution should be saved to a file. The file should be stored in a `__reasoning__` directory adjacent to the test file and should be named `<testFileName>__<describePath>__<itPath>.reasoning.md`. For example, a test in `greeting.eval.ts` with `describe("Greeting agent")` and `it("should say hello")` would use `__reasoning__/greeting__Greeting_agent__should_say_hello.reasoning.md`.

If an existing reasoning file is present, it should save a new file with a timestamp appended to the filename to avoid overwriting the existing reasoning. For example, `greeting__Greeting_agent__should_say_hello__20240601T120000.reasoning.md`.

The file should contain both the reasoning and the final output of the agent's execution.

