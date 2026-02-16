# Feature: Configuration (`katt.json`)

## Scope

This spec defines the currently supported behavior for project-level
configuration loaded from `katt.json`.

Agent runtime configuration and prompt timeout defaults loaded from `katt.json`
are in scope.

## File Location

- Configuration file name: `katt.json`
- Resolution base: `process.cwd()`
- Resolved path: `<cwd>/katt.json`

No parent-directory search is performed.

## Supported Schema

Top-level JSON object with optional `agent`, `agentOptions`, and `prompt`
objects:

```json
{
  "agent": "gh-copilot",
  "agentOptions": {
    "model": "gpt-5-mini",
    "anyOtherProviderKey": "allowed"
  },
  "prompt": {
    "timeoutMs": 600000
  }
}
```

Supported keys:

- `agent?: string`
  - Supported values: `"gh-copilot"`, `"codex"`
  - Missing/unsupported values default runtime selection to `"gh-copilot"`
- `agentOptions?: object`
- `agentOptions.model?: string`
- Additional `agentOptions` behavior:
  - `gh-copilot`: forwarded to Copilot `createSession(...)`
  - `codex`: supported keys are translated to `codex exec` flags:
    - `profile`, `sandbox`, `fullAuto`, `skipGitRepoCheck`,
      `dangerouslyBypassApprovalsAndSandbox`, `config`, `workingDirectory`
    - unsupported keys are ignored by the Codex runner
- `prompt?: object`
- `prompt.timeoutMs?: number` (positive values only)

`agentOptions` are only read when `agent` is explicitly set to a supported
value.

## Functional Behavior

### Reading config

`getDefaultKattConfig()`:

1. Attempts to read `<cwd>/katt.json` as UTF-8.
2. If file is missing (`ENOENT`), returns defaults:
   - `agent: "gh-copilot"`
   - `agentOptions: undefined`
   - `promptTimeoutMs: undefined`
3. Parses JSON content.
4. Resolves `agent`:
   - Uses `agent` when it is `"gh-copilot"` or `"codex"`
   - Otherwise falls back to `"gh-copilot"`
5. Returns `agentOptions` only when:
   - `agent` in file is a supported value, and
   - `agentOptions` is a JSON object.
6. If `agentOptions.model` exists but is not a non-empty string, `model` is
   removed.
7. Returns `undefined` for `agentOptions` when no valid keys remain after
   normalization.

`getDefaultCopilotConfig()`:

1. Reads defaults via `getDefaultKattConfig()`.
2. Returns `agentOptions` only when selected `agent` is `"gh-copilot"`.
3. Returns `undefined` when selected `agent` is `"codex"`.

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
  - Returns defaults/`undefined` values as applicable
  - Logs warning beginning with `Failed to parse katt.json:`
- Read error other than `ENOENT`:
  - Returns defaults/`undefined` values as applicable
  - Logs warning beginning with `Failed to read katt.json:`
- Non-object JSON values (for top-level, `agentOptions`, `prompt`):
  - Treated as invalid config sections
- Unsupported `agent` values:
  - Runtime defaults to `gh-copilot`
  - `agentOptions` from file are not applied
- Missing/empty/non-string `agentOptions.model`:
  - `model` is not forwarded
  - other valid `agentOptions` keys still apply
- Missing/non-number/non-positive/non-finite `prompt.timeoutMs`:
  - Treated as unset timeout
  - returns `undefined` timeout

## Session Option Precedence

For `prompt(input, options?)` and `promptFile(filePath, options?)`:

1. Resolve active runtime from `katt.json` `agent`:
   - `"gh-copilot"` or `"codex"`
   - fallback `"gh-copilot"` when missing/unsupported
2. Start from `katt.json` `agentOptions` when available for the selected
   runtime.
3. Merge in `options` from `prompt()`/`promptFile()`, where explicit call
   options override matching config keys.
4. Normalize `model` to only a non-empty string.
5. Execute with selected runtime:
   - `gh-copilot`: create Copilot session with merged options
   - `codex`: run `codex exec` with mapped supported options
6. Resolve prompt timeout with precedence:
   - `options.timeoutMs` (valid positive number)
   - `katt.json` `prompt.timeoutMs` (valid positive number)
   - default `600000` milliseconds

## Non-Goals

- Defining environment-variable config
- Defining config discovery outside `process.cwd()`
