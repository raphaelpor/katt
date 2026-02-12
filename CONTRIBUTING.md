# Contributing to Katt

Thank you for your interest in contributing to Katt! We welcome contributions from the community and are excited to have you join us in making Katt better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Community and Communication](#community-and-communication)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors. We expect all participants to:

- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

Katt is a lightweight testing framework for running AI Evals, designed to evaluate and validate the behavior of AI agents. Before contributing, we recommend:

1. **Familiarize yourself with the project**: Read the [README.md](README.md) to understand what Katt does and how it works
2. **Explore the codebase**: Browse through the source code in the `src/` directory
3. **Try the examples**: Run the example eval files in the `examples/` directory
4. **Read the specifications**: Check out the `specs/` directory for detailed documentation

## Development Setup

### Prerequisites

- Node.js (latest LTS version recommended)
- npm (comes with Node.js)
- Git

### Initial Setup

1. **Fork the repository**: Click the "Fork" button on GitHub to create your own copy

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/katt.git
   cd katt
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/nentgroup/katt.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Verify your setup**:
   ```bash
   npm run format
   npm run typecheck
   npm run test
   npm run build
   npm run test:build
   ```

## How to Contribute

There are many ways to contribute to Katt:

### Code Contributions

- **Fix bugs**: Look for issues labeled `bug` or `good first issue`
- **Add features**: Propose and implement new functionality
- **Improve performance**: Optimize existing code
- **Refactor**: Improve code quality and maintainability

### Non-Code Contributions

- **Documentation**: Improve README, add examples, write tutorials
- **Examples**: Create new eval file examples demonstrating features
- **Issue triage**: Help categorize and reproduce reported issues
- **Community support**: Answer questions and help other contributors

## Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - for new features
- `fix/` - for bug fixes
- `docs/` - for documentation changes
- `refactor/` - for code refactoring
- `test/` - for test additions or modifications

### 2. Make Your Changes

- Write clean, maintainable code
- Follow the existing code style
- Add or update tests as needed
- Update documentation if you're changing functionality

### 3. Keep Your Branch Updated

Regularly sync with the upstream repository:

```bash
git fetch upstream
git rebase upstream/main
```

### 4. Run the Verification Process

Before committing, **always** run the full verification sequence:

```bash
npm run format      # Format code with Biome
npm run typecheck   # Check TypeScript types
npm run test        # Run tests
npm run build       # Build the project
npm run test:build  # Test the built CLI
```

All steps must pass before submitting a pull request.

### 5. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: add support for custom matchers"
```

Commit message format:
- `feat:` - new feature
- `fix:` - bug fix
- `docs:` - documentation changes
- `test:` - test additions or changes
- `refactor:` - code refactoring
- `chore:` - maintenance tasks

### 6. Push and Create Pull Request

```bash
git push origin your-branch-name
```

Then open a pull request on GitHub.

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Ensure strict type safety (no `any` types unless absolutely necessary)
- Add proper type definitions for new functions and modules

### Code Style

We use Biome for code formatting and linting:

- Run `npm run format` to automatically format your code
- Run `npm run lint` to check for linting issues
- Follow the existing code style in the project

### File Organization

```
src/
├── cli/          # CLI implementation
├── lib/          # Core libraries (describe, it, expect, prompt)
└── types/        # TypeScript type definitions
```

Place new files in the appropriate directory based on their purpose.

### Best Practices

- Keep functions small and focused
- Use descriptive variable and function names
- Add comments for complex logic
- Avoid duplicating code
- Handle errors gracefully

## Testing

### Writing Tests

- Place tests in files with `.test.ts` extension
- Use Vitest for unit tests
- Place eval examples in the `examples/` directory
- Ensure all new features have corresponding tests

### Running Tests

```bash
npm run test                # Run all tests
npm run test -- --watch     # Run tests in watch mode
npm run test:build          # Test the built CLI
```

### Test Coverage

- Aim for high test coverage on new code
- Test both success and error cases
- Include edge cases in your tests

## Pull Request Process

### Before Submitting

1. Ensure all tests pass
2. Run the full verification process
3. Update documentation if needed
4. Add or update examples if appropriate
5. Check that your code follows the project's coding standards

### Pull Request Description

Provide a clear description of your changes:

- **What**: Describe what changes you made
- **Why**: Explain why these changes are needed
- **How**: Briefly describe your approach
- **Testing**: Describe how you tested your changes

### Review Process

1. A maintainer will review your pull request
2. Address any requested changes
3. Once approved, your PR will be merged
4. Your contribution will be included in the next release

### After Your PR is Merged

- Delete your feature branch
- Update your local main branch:
  ```bash
  git checkout main
  git pull upstream main
  ```

## Reporting Issues

### Before Creating an Issue

- Search existing issues to avoid duplicates
- Try to reproduce the issue with the latest version
- Gather relevant information (error messages, steps to reproduce, etc.)

### Creating a Good Issue

Include:

1. **Clear title**: Summarize the issue in one line
2. **Description**: Detailed explanation of the problem
3. **Steps to reproduce**: Numbered steps to recreate the issue
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happens
6. **Environment**: Node.js version, OS, etc.
7. **Additional context**: Screenshots, error logs, etc.

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed

## Community and Communication

### Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Request Comments**: For code review discussions

### Recognition

We value all contributions! Contributors will be:

- Acknowledged in release notes
- Listed in the project's contributors page
- Part of our growing community

### Stay Updated

- Watch the repository to get notifications
- Check the project regularly for updates
- Participate in discussions

## License

By contributing to Katt, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to Katt! Your efforts help make AI evaluation better for everyone. 🎉
