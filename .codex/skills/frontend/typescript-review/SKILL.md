---
name: typescript-review
description: Review TypeScript and JavaScript code changes for compliance with Metabase coding standards, style violations, and code quality issues. Use when reviewing pull requests or diffs containing TypeScript/JavaScript code.
allowed-tools: Read, Grep, Bash, Glob
---

# TypeScript/JavaScript Code Review Skill

## Linting and Formatting

- **Lint:** `bun run lint-eslint-pure`
  - Run ESLint on the codebase
- **Format:** `bun run prettier`
  - Format code using Prettier
- **Type Check:** `bun run type-check-pure`
  - Run TypeScript type checking

## Testing

### JavaScript/TypeScript Tests

- **Test a specific file:** `bun run test-unit-keep-cljs path/to/file.unit.spec.js`
- **Test by pattern:** `bun run test-unit-keep-cljs -t "pattern"`
  - Runs tests matching the given pattern

### ClojureScript Tests

- **Test ClojureScript:** `bun run test-cljs`
  - Run ClojureScript tests

## Code Review Guidelines

Review pull requests with a focus on:

- Readability and maintainability
- Appropriate test coverage
- Compliance with project coding standards and conventions
- Code quality and best practices
- Type safety and proper TypeScript usage
- React best practices (when applicable)