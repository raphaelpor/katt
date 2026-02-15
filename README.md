# Katt

Katt is a lightweight testing framework for running AI Evals, inspired by [Jest](https://github.com/jestjs/jest).

<img src="https://raw.githubusercontent.com/raphaelpor/katt/main/docs/logo.png" alt="Katt logo" width="250" />

## Table of Contents

- [Overview](#overview)
- [API Documentation](#api-documentation)
- [Hello World - Example](#hello-world---example)
- [Main Features](#main-features)
- [Usage](#usage)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Using promptFile](#using-promptfile)
- [Specifying AI Models](#specifying-ai-models)
- [Development](#development)
- [Setup](#setup)
- [Available Scripts](#available-scripts)
- [Verification Process](#verification-process)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Requirements](#requirements)
- [License](#license)
- [Contributing](#contributing)

## Overview

Katt is designed to evaluate and validate the behavior of AI agents like **Claude Code**, **GitHub Copilot**, **OpenAI Codex** and more. It provides a simple, intuitive API for writing tests that interact with AI models and assert their responses.

## API Documentation

For a complete list of features and usage examples, see [docs/api-documentation.md](docs/api-documentation.md).

## Hello World - Example

```typescript
const result = await prompt("If you read this just say 'hello world'");
expect(result).toContain("hello world");
```

It also supports the familiar `describe` and `it` syntax for organizing tests:

```typescript
describe("Greeting agent", () => {
  it("should say hello world", async () => {
    const result = await prompt("If you read this just say 'hello world'");
    expect(result).toContain("hello world");
  });
});
```

## Main Features

- **Simple Testing API**: Familiar `describe` and `it` syntax for organizing tests
- **AI Interaction and Verification**: Built-in `prompt()`, `promptFile()` and `promptCheck()` functions for running and analyzing prompts to AI agents
- **Classification Matcher**: Built-in `toBeClassifiedAs()` matcher to grade a response against a target label on a 1-5 scale
- **Concurrent Execution**: Runs eval files concurrently for faster test execution
- **Model Selection**: Support for specifying custom AI models
- **Configurable Timeouts**: Override prompt wait time per test or via `katt.json`

## Usage

### Installation

```bash
npm install -g katt
```

### Basic Usage

1. Create a file with the `.eval.ts` or `.eval.js` extension and write your tests.
```typescript
const result = await prompt("If you read this just say 'hello world'");
expect(result).toContain("hello world");
```

2. Run Katt from your project directory:

```bash
katt
```

### Using promptFile

Load prompts from external files:

```javascript
// test.eval.js
describe("Working with files", () => {
  it("should load the file and respond", async () => {
    const result = await promptFile("./myPrompt.md");
    expect(result).toContain("expected response");
  });
});
```

### Specifying AI Models

You can specify a custom model for your prompts:

```javascript
describe("Model selection", () => {
  it("should use a specific model", async () => {
    const promptString = "You are a helpful agent. Say hi and ask what you could help the user with.";
    const result = await prompt(promptString, { model: "gpt-5.2" });

    expect(result).promptCheck("It should be friendly and helpful");
  });
});
```

You can also set a default model for the project by adding a `katt.json` file in the project root:

```json
{
  "copilot": {
    "model": "gpt-5-mini"
  },
  "prompt": {
    "timeoutMs": 240000
  }
}
```

When this file exists:

- `prompt("...")` and `promptFile("...")` use `copilot.model` by default
- `prompt("...", { model: "..." })` still overrides the config value
- `prompt.timeoutMs` sets the default wait timeout for long-running prompts

## Development

### Setup

```bash
npm install
```

### Available Scripts

- `npm run dev` - Run the CLI in development mode
- `npm run build` - Build the project
- `npm run test` - Run tests
- `npm run typecheck` - Run TypeScript type checking
- `npm run format` - Format code using Biome
- `npm run lint` - Lint code using Biome
- `npm run test:build` - Test the built CLI

### Verification Process

After making changes, run the following sequence:

1. `npm run format`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `npm run test:build`

## Project Structure

```
katt/
├── src/              # Source code
│   ├── cli/          # CLI implementation
│   ├── lib/          # Core libraries (describe, it, expect, prompt)
│   └── types/        # TypeScript type definitions
├── examples/         # Example eval files
├── specs/            # Markdown specifications
├── package.json      # Package configuration
└── tsconfig.json     # TypeScript configuration
```

## How It Works

1. Katt searches the current directory recursively for `*.eval.js` and `*.eval.ts` files
2. It skips `.git` and `node_modules` directories
3. Found eval files are imported and executed concurrently
4. Tests registered with `describe()` and `it()` are collected and run
5. Each test duration is printed after execution
6. A summary is displayed showing passed/failed tests and total duration
7. Katt exits with code `0` on success or `1` on failure

## Requirements

- Node.js
- GitHub Copilot CLI installed (see [GitHub Copilot CLI installation docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/install-copilot-cli))
- Access to AI models (e.g., OpenAI API key for Codex)

## License

MIT

## Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) guide for detailed information on how to contribute to Katt.

Quick start:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the verification process
5. Submit a pull request

For detailed guidelines, development setup, coding standards, and more, check out our [contribution guide](CONTRIBUTING.md).
