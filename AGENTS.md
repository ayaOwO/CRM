# Commit messages

Use Conventional Commits for all commit messages:

```text
type(scope): description
```

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scope is optional, for example `frontend` or `backend`.
- Write a short, imperative description, for example "add" rather than "added".
- For breaking changes, add `!` before the colon or a `BREAKING CHANGE:` footer.
- An optional body may explain the reason for the change.

Examples:

```text
feat(frontend): add today's meetings timeline
fix(backend): correct appointment validation
docs: update setup instructions
```
