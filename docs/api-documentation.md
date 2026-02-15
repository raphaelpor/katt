# Katt API Documentation

This document lists the currently available Katt features and how to use them.

## Table of Contents

- [Feature Overview](#feature-overview)
- [Imports](#imports)
- [`describe(description, fn)`](#describedescription-fn)
- [`it(description, fn)`](#itdescription-fn)
- [`expect(value)`](#expectvalue)
- [Matchers](#matchers)
- [`.toContain(substring)`](#tocontainsubstring)
- [`.toMatchSnapshot()`](#tomatchsnapshot)
- [`.promptCheck(instructions)`](#promptcheckinstructions)
- [`.toBeClassifiedAs(classification, options?)`](#tobeclassifiedasclassification-options)
- [Prompt APIs](#prompt-apis)
- [`prompt(input, options?)`](#promptinput-options)
- [`promptFile(filePath, options?)`](#promptfilefilepath-options)
- [Configuration](#configuration)
- [`katt.json`](#kattjson)
- [CLI Behavior](#cli-behavior)
- [Eval file discovery](#eval-file-discovery)
- [Execution and results](#execution-and-results)

## Feature Overview

- Imported test APIs available in eval files (`describe`, `it`, `expect`, `prompt`, `promptFile`)
- String matcher: `toContain`
- Snapshot matcher: `toMatchSnapshot`
- AI-based matcher: `promptCheck`
- AI-based classification matcher: `toBeClassifiedAs`
- Prompt execution with optional Copilot session option overrides
- Prompt loading from files with relative-path resolution
- Default Copilot session configuration via `katt.json`
- Configurable prompt timeout with a safer long-task default
- Automatic discovery and execution of `*.eval.js` and `*.eval.ts`
- Concurrent eval-file execution
- Test summary, token usage tracking, and non-zero exit on failure

## Imports

Eval files must import Katt APIs.

```ts
import { describe, expect, it, prompt, promptFile } from "katt";
```

### `describe(description, fn)`

Groups related tests.

```ts
describe("Greeting behavior", () => {
  it("responds with hello", async () => {
    const result = await prompt("Say hello");
    expect(result).toContain("hello");
  });
});
```

### `it(description, fn)`

Defines a single test case.

```ts
it("returns a concise answer", async () => {
  const result = await prompt("Answer in one short sentence: What is HTML?");
  expect(result).promptCheck("The response should be concise and mention markup.");
});
```

### `expect(value)`

Creates an assertion object with available matchers.

```ts
const result = await prompt("Say: Katt is useful.");
expect(result).toContain("Katt");
```

## Matchers

### `.toContain(substring)`

Checks if the response contains a substring.

```ts
const result = await prompt("Reply with: version 1.0.0");
expect(result).toContain("1.0.0");
```

### `.toMatchSnapshot()`

Stores and compares output snapshots as Markdown files.

Behavior:
- Snapshot location: `__snapshots__/<evalFileName>.snap.md` next to the eval file
- Example: `greeting.eval.ts` uses `__snapshots__/greeting.snap.md`
- Snapshot content is the raw output string with no extra formatting
- First run creates the snapshot automatically
- Later runs compare against saved content and fail on mismatch with a diff

```ts
const result = await prompt("Say hello in one sentence.");
expect(result).toMatchSnapshot();
```

To accept changed output:

```bash
katt --update-snapshots
```

### `.promptCheck(instructions)`

Uses an AI evaluator to verify whether the response satisfies an instruction.

```ts
const result = await prompt("Write one friendly greeting.");
await expect(result).promptCheck("It should contain a friendly greeting.");
```

### `.toBeClassifiedAs(classification, options?)`

Asks an AI evaluator to score the response from 1-5 for a given classification.
Fails when score is below `threshold` (default `3`).

`options`:
- `model?: string`
- `threshold?: number`

```ts
const result = await prompt("Help a user debug a failing unit test.");
await expect(result).toBeClassifiedAs("helpful", {
  model: "gpt-5.2",
  threshold: 4,
});
```

## Prompt APIs

### `prompt(input, options?)`

Sends `input` to the AI model and returns the response string.

`options`:
- Any Copilot session option (for example: `model`, `reasoningEffort`,
  `streaming`)
- `timeoutMs?: number` to control how long to wait for `session.idle`
- Explicit options override matching keys from `katt.json`

Timeout precedence:
- `options.timeoutMs` (when valid and positive)
- `katt.json` `prompt.timeoutMs` (when valid and positive)
- Built-in default: `600000` ms

```ts
const result = await prompt("Return exactly: PASS", { model: "gpt-5-mini" });
expect(result).toContain("PASS");
```

### `promptFile(filePath, options?)`

Reads a file and sends the file contents as the prompt.

Path behavior:
- Absolute path: used as-is
- Relative path inside eval execution: resolved from the eval file directory
- Relative path otherwise: resolved from `process.cwd()`

```ts
const result = await promptFile("./prompts/smoke-test.md");
expect(result).toContain("expected phrase");
```

## Configuration

### `katt.json`

Set default Copilot session options:

```json
{
  "copilot": {
    "model": "gpt-5-mini",
    "reasoningEffort": "high",
    "streaming": true
  },
  "prompt": {
    "timeoutMs": 240000
  }
}
```

Behavior:
- `prompt("...")` and `promptFile("...")` use `copilot` values as default
  session options
- Passing `options` to `prompt`/`promptFile` overrides matching keys from config
- `prompt.timeoutMs` sets the default wait timeout for prompt completion

## CLI Behavior

### Eval file discovery

- Recursively finds `*.eval.js` and `*.eval.ts` from current working directory
- Skips `.git` and `node_modules`

### Execution and results

- Prints the Katt ASCII banner with the current CLI version directly below it
- Imports and executes eval files concurrently
- Waits for pending async tests
- Prints failures and exits with code `1` on any failure
- Prints summary and exits with code `0` when all pass
- Supports `--update-snapshots` (or `-u`) to update snapshot files on mismatch

Run:

```bash
katt
```
