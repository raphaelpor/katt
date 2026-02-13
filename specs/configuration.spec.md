# Feature: Configuration (`katt.json`)

## Scope

This spec defines the currently supported behavior for project-level configuration
loaded from `katt.json`.

Copilot session configuration and prompt timeout defaults loaded from
`katt.json` are in scope.

## File Location

- Configuration file name: `katt.json`
- Resolution base: `process.cwd()`
- Resolved path: `<cwd>/katt.json`

No parent-directory search is performed.

## Supported Schema

Top-level JSON object with optional `copilot` and `prompt` objects:

```json
{
  "copilot": {
    "model": "gpt-5-mini",
    "anyOtherCopilotKey": "allowed"
  },
  "prompt": {
    "timeoutMs": 600000
  }
}
```

Supported keys:

- `copilot?: object`
- `copilot.model?: string`
- Any additional `copilot` keys supported by Copilot session creation are allowed
  and forwarded to the Copilot session request.
- `prompt?: object`
- `prompt.timeoutMs?: number` (positive values only)

Within `copilot`, additional keys are treated as Copilot session options.
Within `prompt`, only `timeoutMs` is currently read.

## Functional Behavior

### Reading config

`getDefaultCopilotConfig()`:

1. Attempts to read `<cwd>/katt.json` as UTF-8.
2. If file is missing (`ENOENT`), returns `undefined`.
3. Parses JSON content.
4. Returns `copilot` only when it is a JSON object.
5. If `copilot.model` exists but is not a non-empty string, `model` is removed.
6. Returns `undefined` when no valid `copilot` options remain after normalization.

`getDefaultPromptTimeoutMs()`:

1. Attempts to read `<cwd>/katt.json` as UTF-8.
2. If file is missing (`ENOENT`), returns `undefined`.
3. Parses JSON content.
4. Reads `prompt.timeoutMs` only when `prompt` is a JSON object.
5. Returns normalized timeout when it is a positive finite number:
   - Value is floored to an integer.
6. Returns `undefined` for invalid/missing timeout values.

### Invalid data handling

- Invalid JSON:
  - Returns `undefined`
  - Logs warning beginning with `Failed to parse katt.json:`
- Read error other than `ENOENT`:
  - Returns `undefined`
  - Logs warning beginning with `Failed to read katt.json:`
- Non-object JSON values (e.g. string/number/array/null):
  - Treated as invalid config
  - Returns `undefined`
- Non-object `copilot` values:
  - Treated as invalid `copilot` config
  - Returns `undefined`
- Missing/empty/non-string `copilot.model`:
  - `model` is not forwarded
  - Other valid `copilot` keys still apply
- Non-object `prompt` values:
  - Treated as invalid `prompt` config
  - Returns `undefined` timeout
- Missing/non-number/non-positive/non-finite `prompt.timeoutMs`:
  - Treated as unset timeout
  - Returns `undefined` timeout

## Session Option Precedence

For `prompt(input, options?)` and `promptFile(filePath, options?)`:

1. Start from `katt.json` `copilot` session options when available.
2. Merge in `options` from `prompt()`/`promptFile()`, where explicit call options
   override config values for matching keys.
3. Normalize `model` to only a non-empty string.
4. Create Copilot session with merged options, or default session options when
   merged options are empty.
5. Resolve send-and-wait timeout with precedence:
   - `options.timeoutMs` (valid positive number)
   - `katt.json` `prompt.timeoutMs` (valid positive number)
   - default `600000` milliseconds

## Non-Goals

- Defining environment-variable config
- Defining config discovery outside `process.cwd()`
