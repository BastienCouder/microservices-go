Main branch protection to configure in GitHub:

1. Open `Settings` -> `Branches` or `Rulesets`.
2. Protect `main`.
3. Disable direct pushes to `main`.
4. Require a pull request before merging.
5. Require these status checks to pass:
   - `Branch policy`
   - `Go checks`
   - `App checks`
   - `Web checks`
   - `TypeScript service / crawler-service`
   - `TypeScript service / langgraph-scheduler`
   - `Email build`
6. The `Branch policy` workflow check enforces `develop` -> `main` pull requests.
7. Optionally require at least 1 approval before merge.
