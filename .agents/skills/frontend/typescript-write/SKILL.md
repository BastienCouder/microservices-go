---
name: typescript-write
description: Write TypeScript and JavaScript code following Metabase coding standards and best practices. Use when developing or refactoring TypeScript/JavaScript code.
---

# TypeScript/JavaScript Development Skill

## Autonomous Development Workflow

- Do not attempt to read or edit files outside the project folder
- Add failing tests first, then fix them
- Work autonomously in small, testable increments
- Run targeted tests, and lint continuously during development
- Prioritize understanding existing patterns before implementing
- Don't commit changes, leave it for the user to review and make commits

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