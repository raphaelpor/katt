# Feature: Configuration (`katt.json`)

## Scope

This spec defines the currently supported behavior for project-level configuration
loaded from `katt.json`.

Copilot session configuration loaded from `katt.json` is in scope.

## File Location

- Configuration file name: `katt.json`
- Resolution base: `process.cwd()`
- Resolved path: `<cwd>/katt.json`

No parent-directory search is performed.

## Supported Schema

Top-level JSON object with optional `copilot` object:

```json
{
  "copilot": {
    "model": "gpt-5-mini",
    "anyOtherCopilotKey": "allowed"
  }
}
```

Supported keys:

- `copilot?: object`
- `copilot.model?: string`
- Any additional `copilot` keys supported by Copilot session creation are allowed
  and forwarded to the Copilot session request.

Within `copilot`, additional keys are treated as Copilot session options.

## Functional Behavior

### Reading config

`getDefaultCopilotConfig()`:

1. Attempts to read `<cwd>/katt.json` as UTF-8.
2. If file is missing (`ENOENT`), returns `undefined`.
3. Parses JSON content.
4. Returns `copilot` only when it is a JSON object.
5. If `copilot.model` exists but is not a non-empty string, `model` is removed.
6. Returns `undefined` when no valid `copilot` options remain after normalization.

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

## Session Option Precedence

For `prompt(input, options?)` and `promptFile(filePath, options?)`:

1. Start from `katt.json` `copilot` session options when available.
2. Merge in `options` from `prompt()`/`promptFile()`, where explicit call options
   override config values for matching keys.
3. Normalize `model` to only a non-empty string.
4. Create Copilot session with merged options, or default session options when
   merged options are empty.

## Non-Goals

- Defining environment-variable config
- Defining config discovery outside `process.cwd()`
