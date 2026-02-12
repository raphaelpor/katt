# Agents

## Project Overview
- CLI tool written in TypeScript
- Installed via npm
- Tests the output of agentic AI tools

## Verification Process
Run this sequence after every code change:

1. `npm run format`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. `npm run test:build`

# Folder structure:
- `src/`: source code for the CLI tool
- `examples/`: example eval files for testing
- `specs/`: markdown files containing specifications for the CLI tool
- `docs/api-documentation.md`: authoritative feature/API documentation with examples

## Documentation Maintenance
- When adding a new feature or changing existing feature behavior, update `docs/api-documentation.md` in the same change.
- Keep examples in `docs/api-documentation.md` aligned with actual current behavior and public APIs.
