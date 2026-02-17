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
  - `options?: Record<string, unknown> & { timeoutMs?: number }`
    - `timeoutMs` controls how long to wait for completion.
- Output:
  - `Promise<string>` containing the assistant response content.

### `promptFile(filePath, options?)`

- Input:
  - `filePath: string`
  - `options?: Record<string, unknown> & { timeoutMs?: number }`
- Output:
  - `Promise<string>` containing the assistant response content after sending
    file contents as the prompt.

## Functional Behavior

### `prompt()`

1. Loads defaults from active config:
   - default: `<cwd>/katt.json`
   - CLI override: `--config-file <path>`
2. Resolves active runtime:
   - `gh-copilot` or `codex`
   - defaults to `gh-copilot` when `agent` is missing/unsupported.
3. Resolves runtime options:
   - merges config `agentOptions` (base) with explicit `options`
   - explicit `options` override matching keys
   - `model` is normalized to a non-empty string only.
4. Resolves prompt timeout:
   - `options.timeoutMs` (if valid positive number) has highest precedence.
   - config `prompt.timeoutMs` (if valid positive number) is fallback.
   - default timeout is `600000` milliseconds.
5. Executes using selected runtime:
   - `gh-copilot`:
     1. creates a Copilot client with logged-in-user auth
     2. starts the client lifecycle
     3. creates a Copilot session with merged options
     4. sends `{ prompt: input }` and waits with resolved timeout
     5. returns `response.data.content`
     6. throws `Error("Copilot did not return a response.")` if content missing
   - `codex`:
     1. runs `codex exec` non-interactively
     2. passes supported options as command flags/config overrides
     3. sends prompt through stdin
     4. reads the last assistant message from output file (or stdout fallback)
     5. returns response text
     6. throws:
        - `Error("Codex did not return a response.")` when no output is
          available
        - timeout/process errors when Codex fails to execute successfully.

### Cleanup guarantees for `prompt()`

- `gh-copilot` cleanup runs in a `finally` block regardless of success/failure:
  1. attempts to destroy the created session (if any)
  2. attempts to stop the Copilot client
  3. aggregates cleanup failures from both steps
  4. if one or more cleanup failures occur, logs:
     - `Copilot cleanup encountered <N> error(s).`
- `codex` runtime always removes temporary output artifacts used for response
  extraction.

Cleanup logging does not replace the primary operation result/error.

### `promptFile()`

1. Resolves `filePath`:
   - absolute path: used as-is
   - relative path in eval-file context: resolved from the eval file directory
   - relative path outside eval-file context: resolved from `process.cwd()`
2. Reads UTF-8 file content from the resolved path.
3. Delegates to `prompt(content, options)` and returns its result.

## Error Propagation

- File read failures in `promptFile()` are propagated to the caller.
- Copilot/session errors in `prompt()` are propagated to the caller.
- Codex process startup/exit/timeout errors in `prompt()` are propagated to the
  caller.
- Missing response content in `prompt()` is converted to the explicit runtime
  errors defined above.

## Non-Goals

- Defining CLI-level execution order, eval-file discovery, async test
  orchestration, or process exit codes.
- Defining assertion/matcher behavior (`expect`, `toContain`, etc.).
