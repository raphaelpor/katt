<img src="https://raw.githubusercontent.com/raphaelpor/katt/main/docs/logo.png" alt="Katt logo" width="250" />

# Introducing `Katt`

## Test your agentic workflows like you test code

Agentic tools can feel magical: you describe intent, they plan, they change files, they run commands, and they explain what they did. But that “magic” has a cost:

- **Non-determinism**: small prompt changes (or model updates) can produce large behavioral differences.
- **Invisible regressions**: a workflow that worked yesterday can fail today, without any code change.
- **Confidence without evidence**: demos are persuasive, but they’re not data.

Katt exists for teams that want the upside of agentic tooling *without* flying blind. It’s a lightweight testing framework for AI evals, inspired by Jest, that helps you turn prompts and agent behaviors into repeatable checks.

## The problem: agentic output is easy to trust and hard to verify

If you’ve ever said “wow, it did the right thing!” and then struggled to reproduce it later, you’ve already met the core problem.

Agentic workflows are usually built from:

1. A prompt (or prompt file)
2. A model/runtime configuration
3. A tool context (repo state, files, APIs)
4. A set of expectations about the output

When any of those change, the behavior can drift. Without tests, drift shows up as:

- broken automation in CI
- subtle style changes in generated code
- safety or policy violations in outputs
- “it depends” answers that break downstream parsing

Katt’s goal is simple: **make agent behavior testable**, so you can iterate with evidence.

## What Katt is (and what it isn’t)

Katt is a CLI tool that discovers and executes eval files (`*.eval.js` / `*.eval.ts`). Inside those files, you write tests using a familiar API:

- `describe()` / `it()` for structure
- `prompt()` and `promptFile()` to run prompts
- `expect()` with matchers to assert on results

Katt is not trying to replace full application test suites. Instead, it targets the gap that shows up when “the prompt *is* the program”.

## Quick start: your first eval

Create a file like `greeting.eval.ts`:

```ts
import { describe, expect, it, prompt } from "katt";

describe("Greeting agent", () => {
  it("should say hello world", async () => {
    const result = await prompt("If you read this just say 'hello world'");
    expect(result).toContain("hello world");
  });
});
```

Run it from your project directory:

```bash
npx katt
```

Katt will:

- recursively discover `*.eval.js` and `*.eval.ts` from your current directory
- execute eval files concurrently
- print a summary and exit non-zero on failures

## The testing primitives that matter for agentic workflows

### 1) Make the output *inspectable*: `toContain()`

String assertions are the foundation for smoke tests and contract tests.

```ts
const result = await prompt("Return exactly: PASS");
expect(result).toContain("PASS");
```

This is intentionally simple—and surprisingly powerful when you’re validating:

- key phrases or constraints
- required JSON keys
- response format “shape”

### 2) Make drift visible: `toMatchSnapshot()`

Snapshots help you notice when “the same prompt” yields different output later.

```ts
const result = await prompt("Say hello in one sentence.");
expect(result).toMatchSnapshot();
```

On first run, Katt creates the snapshot automatically. On later runs, mismatches fail with a diff.

When an intentional change happens, update snapshots explicitly:

```bash
npx katt --update-snapshots
```

Snapshots are especially useful for:

- CLI tool outputs
- agentic “explanations” you want stable
- content generation where style consistency matters

### 3) Test intent, not just substrings: `promptCheck()`

Some expectations are semantic: “the response should be concise”, “should include next steps”, “should mention risks”. Katt supports AI-based evaluation via `promptCheck()`.

```ts
import { expect, prompt } from "katt";

const result = await prompt("Explain HTML in one short sentence.");
await expect(result).promptCheck(
  "The response should be concise and mention that HTML is markup."
);
```

This is how you test *behavioral requirements* without turning them into brittle string checks.

### 4) Grade behavior with a threshold: `toBeClassifiedAs()`

When you want a more structured quality signal, use classification scoring.

```ts
const result = await prompt("Help a user debug a failing unit test.");
await expect(result).toBeClassifiedAs("helpful", {
  model: "gpt-5.2",
  threshold: 4,
});
```

This asks an evaluator model to score the response from 1–5 for the label you provide, and fails when the score is below the threshold.

## Prompts as assets: `promptFile()`

Most real workflows treat prompts like source code: versioned, reviewed, iterated.

```ts
import { describe, expect, it, promptFile } from "katt";

describe("Release notes assistant", () => {
  it("should follow our template", async () => {
    const result = await promptFile("./prompts/release-notes.md");
    expect(result).toContain("## Summary");
  });
});
```

Katt resolves relative paths inside eval execution from the eval file’s directory, which makes evals portable across machines and CI.

## Configuration: make model choice and timeouts explicit

Katt supports project defaults through `katt.json` at your current working directory.

```json
{
  "agent": "gh-copilot",
  "agentOptions": {
    "model": "gpt-5-mini",
    "reasoningEffort": "high",
    "streaming": true
  },
  "prompt": {
    "timeoutMs": 240000
  }
}
```

What this buys you:

- A shared default model and session configuration for the whole repo
- A safer timeout for long-running prompts (with a built-in default as a fallback)
- Per-test overrides when you need them

```ts
await prompt("Do a deep analysis", { timeoutMs: 300000 });
```

## Compare the same prompt across models (output, duration, tokens)

One of the most practical uses of evals is **running the same prompt against multiple models** so you can make an explicit tradeoff between:

- output quality and style (does it follow the contract?)
- latency (how long did it take?)
- cost signals (token usage, when available)

Katt already supports this pattern because `prompt()` accepts a per-call `model` override, and Katt logs **duration**, **model**, and **tokens used** per test when usage data is available.

Here’s a minimal way to structure a “model bake-off”:

```ts
import { describe, expect, it, prompt } from "katt";

const PROMPT = "Return a JSON object with keys: date (ISO-8601), source.";
const MODELS = ["gpt-5-mini", "gpt-5.2"];

describe("JSON contract across models", () => {
  for (const model of MODELS) {
    it(`should keep the same contract (${model})`, async () => {
      const result = await prompt(PROMPT, { model });
      expect(result).toMatchSnapshot();
    });
  }
});
```

What you get from a single `npx katt` run:

- separate snapshots per model (because the `it()` name differs)
- per-test timing in milliseconds
- `Model ...` and (when available) `Tokens used ...` lines in the output

This isn’t a dedicated benchmarking dashboard, but it’s enough to make model comparisons **repeatable** and **reviewable** in PRs.

## A practical mindset: how to test agentic workflows well

If you want reliability, aim for **evidence, not vibes**:

- **Start with smoke tests**: small prompts, tight assertions (`toContain`).
- **Add snapshots** for outputs you want stable (`toMatchSnapshot`).
- **Use semantic checks** for intent-level requirements (`promptCheck`, `toBeClassifiedAs`).
- **Keep prompts in files** so they can be reviewed and diffed (`promptFile`).
- **Treat failures as signal**: they’re telling you where the workflow is underspecified.

The best prompt is rarely the cleverest—it’s the one whose behavior you can *verify*.

## Requirements and current runtime integration

Katt runs as a Node.js CLI and executes prompts via GitHub Copilot (using `@github/copilot-sdk` with a logged-in user). In practice that means you need a working Copilot setup on the machine/CI runner where you execute `npx katt`, plus access to the models you select.

If you’re introducing Katt to a team, the simplest rollout is:

1. Add a small `examples/`-style eval file.
2. Run it locally.
3. Put `npx katt` into CI.
4. Grow coverage as you see failures.

## Looking ahead: where Katt could go next

Katt’s core idea—**agentic workflows deserve tests**—is broader than any single AI runtime.

Future directions that fit naturally with Katt’s model include:

- **Additional runtimes/adapters**: first-class integrations for other agentic tools (for example Claude Code, OpenAI Codex, and others), so the same eval files can validate workflows across environments.
- **Better eval ergonomics**: more helpers to standardize prompts, assertions, and repeatable fixtures.

These are intentionally framed as *roadmap ideas*: check the repo docs/specs for what’s supported today.

## Next steps

- Read the API surface in `docs/api-documentation.md`.
- Browse `examples/` to see real evals and snapshots.
- Add one eval file that protects the most important workflow in your team.
