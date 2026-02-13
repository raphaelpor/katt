# Definition
`katt` is a CLI tool that discovers and executes eval files.

## Usage

```bash
katt
```

## Execution Flow

1. The CLI searches the current working directory recursively for files matching:
   - `*.eval.js`
   - `*.eval.ts`
2. Directory scanning skips:
   - `.git`
   - `node_modules`
3. If no eval files are found:
   - It prints `No .eval.js or .eval.ts files found.`
   - It exits with code `1`
4. If eval files are found:
   - They are imported and executed concurrently
   - Each file runs with eval-file context (used by `promptFile()` for relative paths)
5. If one or more eval files fail to import/execute:
   - It prints one error per failed file in the format `Error executing <file>: <reason>`
   - It exits with code `1`
6. After file imports complete, async tests registered by `describe()`/`it()` are awaited
7. After each test, print the duration of its execution in milliseconds.
    - It sshould print:
    ```
    Suite "<hightlight>suite</hightlight>"
    Test "<hightlight>case</hightlight>"
    - ✅ Passed in <hightlight>123ms</hightlight>
    - Model <hightlight>gpt-4o</hightlight>
    - Tokens used <hightlight>48000</hightlight> // Only if tokens usage data is available for the test
    ---
    ```
    - The duration should be in `ms`.
    - The hightlight tags defines that the text should be printed in printed in the color `cyan` and `bold` style.
    - The output should be grouped by test suite, with the suite name printed once before its test cases.
    - Do not use `getContextPrefix` for logging the output.
    - The methods `promptCheck` and `toBeClassifiedAs` should follow the same logging format for passed tests, including printing the duration of their execution.
8. If async test execution rejects:
   - It prints `Error executing async test: <reason>`
   - It exits with code `1`
9. If assertions failed during test execution:
   - It prints:
     - `❌ Failed tests:`
     - Numbered failures with full describe/it path, e.g. `1. suite > case: <message>`
   - It exits with code `1`
10. If no execution or assertion failures are found:
   - It prints: 
   ```
    ---
    Files       <hightlight>7 passed</hightlight>
    Evals       <hightlight>27 passed</hightlight>
    Start at    <hightlight>15:39:24</hightlight>
    Duration    <hightlight>539ms</hightlight>
   ```
   - The printed summary description words should be in the color `cyan` and `bold` style.
     - Example: `Tests` in the above summary should be cyan and bold while `27 passed (27)` should be in default color and style.
   - It exits with code `0`

Note: there is currently no success log line on passing runs.

## Globals Available In Eval Files

Eval files do not need to import test APIs. The following are available on `globalThis`:

- `describe(description, fn)`
- `it(description, fn)`
- `expect(value)`
- `prompt(input, { model?, timeoutMs? })`
- `promptFile(filePath, { model?, timeoutMs? })`

## Example Eval File

```js
// example.eval.js
describe("Greeting agent", () => {
  it("should say hello", async () => {
    const result = await prompt("If you read this, say hello.");
    expect(result).toContain("Hi");
  });
});
```

## Selecting A Model

```js
// example.eval.js
describe("Greeting agent", () => {
  it("should say hello", async () => {
    const result = await prompt("If you read this, say hello.", {
      model: "gpt-5.2",
    });
    expect(result).toContain("Hi");
  });
});
```

## Running A Prompt From A File

```js
// example.eval.js
describe("Greeting agent", () => {
  it("should say hello", async () => {
    const result = await promptFile("./myPrompt.md");
    expect(result).toContain("Hi");
  });
});
```

`promptFile()` also supports model selection:

```js
// example.eval.js
describe("Greeting agent", () => {
  it("should say hello", async () => {
    const result = await promptFile("./myPrompt.md", { model: "gpt-5.2" });
    expect(result).toContain("Hi");
  });
});
```

`prompt()` and `promptFile()` also support timeout overrides for long-running tasks:

```js
describe("Long running task", () => {
  it("waits longer for completion", async () => {
    const result = await prompt("Do a deep analysis", {
      timeoutMs: 300000,
    });
    expect(result).toContain("analysis");
  });
});
```

Path resolution behavior:

- Absolute paths are used directly.
- Relative paths are resolved from the eval file directory when called inside an eval file.
- Outside eval-file context, relative paths resolve from `process.cwd()`.
