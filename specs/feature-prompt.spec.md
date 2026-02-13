# Feature: Prompt APIs (`prompt()` and `promptFile()`)

## Scope

This spec defines behavior for prompt-related APIs only:

- `prompt(input, options?)`
- `promptFile(filePath, options?)`

Execution/discovery flow for eval files and CLI exit handling is specified in
`execution.spec.md` and is intentionally out of scope here.

## API Contracts

### `prompt(input, options?)`

- Input:
  - `input: string`
  - `options?: SessionConfig & { timeoutMs?: number }`
    - `timeoutMs` controls how long to wait for `session.idle`.
- Output:
  - `Promise<string>` containing the assistant response content.

### `promptFile(filePath, options?)`

- Input:
  - `filePath: string`
  - `options?: SessionConfig & { timeoutMs?: number }`
- Output:
  - `Promise<string>` containing the assistant response content after sending
    file contents as the prompt.

## Functional Behavior

### `prompt()`

1. Creates a Copilot client with logged-in-user auth.
2. Starts the client session lifecycle.
3. Creates a Copilot session:
   - Uses merged options from:
     - `katt.json` `copilot` config (base)
     - explicit `options` (override)
   - With default session options when merged options are empty.
4. Resolves prompt timeout:
   - `options.timeoutMs` (if valid positive number) has highest precedence.
   - `katt.json` `prompt.timeoutMs` (if valid positive number) is fallback.
   - Default timeout is `600000` milliseconds.
5. Sends `{ prompt: input }` and waits for completion using the resolved timeout.
6. Returns `response.data.content` as a string.
7. If the response has no content, throws:
   - `Error("Copilot did not return a response.")`

### Cleanup guarantees for `prompt()`

Cleanup runs in a `finally` block regardless of success/failure:

1. Attempts to destroy the created session (if any).
2. Attempts to stop the Copilot client.
3. Aggregates cleanup failures from both steps.
4. If one or more cleanup failures occur, logs:
   - `Copilot cleanup encountered <N> error(s).`

Cleanup logging does not replace the primary operation result/error.

### `promptFile()`

1. Resolves `filePath`:
   - Absolute path: used as-is.
   - Relative path in eval-file context: resolved from the eval file directory.
   - Relative path outside eval-file context: resolved from `process.cwd()`.
2. Reads UTF-8 file content from the resolved path.
3. Delegates to `prompt(content, options)` and returns its result.

## Error Propagation

- File read failures in `promptFile()` are propagated to the caller.
- Copilot/session errors in `prompt()` are propagated to the caller.
- Missing response content in `prompt()` is converted to the explicit error
  defined above.

## Non-Goals

- Defining CLI-level execution order, eval-file discovery, async test
  orchestration, or process exit codes.
- Defining assertion/matcher behavior (`expect`, `toContain`, etc.).
