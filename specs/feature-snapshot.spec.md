# Feature: Snapshot

A test can use the `expect(value).toMatchSnapshot()` API to have its value saved as a snapshot. On subsequent test runs, the value is compared to the saved snapshot. If the value does not match the snapshot, the test fails.

## Snapshot Storage
Snapshots are stored in a `__snapshots__` directory adjacent to the test file. Each snapshot file is named `<testFileName>.snap.md`. For example, snapshots for `greeting.eval.ts` would be stored in `__snapshots__/greeting.snap.md`.

## Snapshot Format

The snapshot content is the pure output value of the `prompt()` or `promptFile()` call, without any additional metadata or formatting. The snapshot is stored as a Markdown file.

## Snapshot Update

When a snapshot test fails due to a value mismatch, the test runner should provide an option to update the snapshot with the new value. This allows developers to easily accept changes in the output when they are expected.

## Diff

When a snapshot test fails, the test runner should display a diff between the expected snapshot value and the actual value. The diff should highlight additions, deletions, and changes to help developers understand what has changed.