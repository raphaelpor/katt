# Feature: Configuration (`katt.json`)

## Scope

This spec defines the currently supported behavior for project-level
configuration loaded from `katt.json` or a user-provided path via CLI.

Agent runtime configuration and prompt timeout defaults loaded from config are
in scope.

## File Location

- Default configuration file name: `katt.json`
- Default resolution base: `process.cwd()`
- Default resolved path: `<cwd>/katt.json`
- Optional override via CLI:
  - `--config-file <path>` or `--config-file=<path>`
  - Relative paths are resolved from `process.cwd()`
  - Absolute paths are used as-is

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

1. Resolves active config path:
   - `<cwd>/katt.json` by default
   - overridden by `--config-file` when provided
2. Attempts to read resolved config file as UTF-8.
3. If file is missing (`ENOENT`), returns defaults:
   - `agent: "gh-copilot"`
   - `agentOptions: undefined`
   - `promptTimeoutMs: undefined`
4. Parses JSON content.
5. Resolves `agent`:
   - Uses `agent` when it is `"gh-copilot"` or `"codex"`
   - Otherwise falls back to `"gh-copilot"`
6. Returns `agentOptions` only when:
   - `agent` in file is a supported value, and
   - `agentOptions` is a JSON object.
7. If `agentOptions.model` exists but is not a non-empty string, `model` is
   removed.
8. Returns `undefined` for `agentOptions` when no valid keys remain after
   normalization.

`getDefaultCopilotConfig()`:

1. Reads defaults via `getDefaultKattConfig()`.
2. Returns `agentOptions` only when selected `agent` is `"gh-copilot"`.
3. Returns `undefined` when selected `agent` is `"codex"`.

`getDefaultPromptTimeoutMs()`:

1. Resolves active config path (default `katt.json`, optional CLI override).
2. Attempts to read resolved config file as UTF-8.
3. If file is missing (`ENOENT`), returns `undefined`.
4. Parses JSON content.
5. Reads `prompt.timeoutMs` only when `prompt` is a JSON object.
6. Returns normalized timeout when it is a positive finite number:
   - Value is floored to an integer.
7. Returns `undefined` for invalid/missing timeout values.

### Invalid data handling

- Invalid JSON:
  - Returns defaults/`undefined` values as applicable
  - Logs warning beginning with `Failed to parse <config-file>:`
- Read error other than `ENOENT`:
  - Returns defaults/`undefined` values as applicable
  - Logs warning beginning with `Failed to read <config-file>:`
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

1. Resolve active runtime from config `agent`:
   - `"gh-copilot"` or `"codex"`
   - fallback `"gh-copilot"` when missing/unsupported
2. Start from config `agentOptions` when available for the selected
   runtime.
3. Merge in `options` from `prompt()`/`promptFile()`, where explicit call
   options override matching config keys.
4. Normalize `model` to only a non-empty string.
5. Execute with selected runtime:
   - `gh-copilot`: create Copilot session with merged options
   - `codex`: run `codex exec` with mapped supported options
6. Resolve prompt timeout with precedence:
   - `options.timeoutMs` (valid positive number)
   - config `prompt.timeoutMs` (valid positive number)
   - default `600000` milliseconds

## CLI Flag Behavior

- `--config-file <path>` sets the config file path used by all prompts in that
  CLI invocation.
- `--config-file=<path>` is equivalent.
- Missing value for `--config-file` causes CLI failure with exit code `1`.
- `--help` exits early and does not require/parse `--config-file`.

## Non-Goals

- Defining environment-variable config
- Defining parent-directory config discovery
