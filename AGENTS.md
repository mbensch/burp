# AGENTS.md

Guidance for AI coding agents working on this repository.

## Tech stack

| Layer | Tool |
|-------|------|
| Runtime | Bun (also Node 22 for native addons) |
| Language | TypeScript (strict mode) |
| TUI framework | Ink 5 (React for CLIs) + ink-text-input, ink-select-input |
| Database | SQLite via `bun:sqlite` |
| RSS parsing | `rss-parser` |
| HTML rendering | `html-to-text` |
| Linting / formatting | Biome |
| Testing | `bun test` |
| Build | `bun build --compile` (native binary to `dist/`) |

## Commands

```bash
bun run test        # run all tests
bun run lint        # check lint and formatting
bun run lint:fix    # auto-fix formatting
bun run build       # build the CLI bundle
```

Always run `bun run test` and `bun run lint` before opening a PR. Fix all errors — warnings are acceptable only if the suppression is genuinely intentional.

## Workflow

1. **Issue first** — Before starting any work, ensure a GitHub issue exists. If one was not specified by the user, create one with `gh issue create` describing the work.
2. **Branch from main** — Create a branch named `issue/<number>-<short-slug>` off the latest `main`.
3. **Do the work** — Implement, test, and lint on the branch.
4. **Update docs if needed** — Before opening a PR, check whether `AGENTS.md` or `README.md` need to reflect your changes (new commands, architecture changes, changed tooling, new conventions, etc.). Update them in the same PR.
5. **Open a PR** — Every PR must:
   - Follow Conventional Commits in the title (e.g. `feat:`, `fix:`, `ci:`) — CI enforces this.
   - Reference the closing issue in the body (`Closes #N`).
   - Be linked to the **Burp - CLI RSS Reader** GitHub project (`--project "Burp - CLI RSS Reader"`).
6. **Never push directly to `main`** — Branch protection requires PRs with passing CI checks.

## Architecture

```
src/index.tsx          CLI entry — parse args, launch TUI or run non-interactive command
src/app.tsx            Root Ink component: view router + all keyboard handling
src/db/connection.ts   Singleton DB (WAL, foreign keys ON, runs migrations on open)
src/db/schema.ts       Schema definition and runMigrations()
src/db/queries.ts      All DB read/write operations — the only layer that touches SQLite
src/services/          Business logic — call query layer, never touch DB directly
src/views/             Ink view components — receive props, emit events, no DB access
src/components/        Small shared UI components (StatusBar, Tag)
```

**Data flow:** `index.tsx` → `app.tsx` → `services/*` + `db/queries.ts` → SQLite

Views are pure presentational components. All state lives in `app.tsx`.

## Key conventions

### TypeScript
- Strict mode is on. All query results from `bun:sqlite` must be cast explicitly, e.g. `.get(...) as MyType | null` (`bun:sqlite` returns `null`, not `undefined`, for missing rows).
- Use `0 | 1` for SQLite boolean columns (`is_read`, `is_starred`), not `boolean`.
- Prefer `interface` over `type` for object shapes.

### Database
- All DB operations go in `src/db/queries.ts`. Never write raw SQL in views or services.
- Use `ON CONFLICT ... DO UPDATE ... RETURNING *` for upserts.
- The FTS5 table (`articles_fts`) is kept in sync via triggers defined in `schema.ts`. Do not manually insert into it.
- `runMigrations()` is idempotent — add new schema changes as a new migration version, never edit existing ones.
- The DB is opened once via `getDb()` in `connection.ts`; pass the instance down as a parameter.

### Ink / React
- Keyboard input is handled centrally in `app.tsx` via `useInput`. Views do not call `useInput` themselves (except for text input fields which use `ink-text-input`).
- `useCallback` and `useEffect` deps must be complete — Biome enforces `useExhaustiveDependencies`.
- Use `flexGrow={1}` to fill available terminal height. The outer `<Box>` in `app.tsx` uses `height={process.stdout.rows}`.

### Services
- Services (`feed.ts`, `opml.ts`, `search.ts`) must not throw to the caller for recoverable errors — catch and return them in an `errors` array or return an empty result.
- Do not make real network calls in tests. Mock `Parser.prototype.parseURL` with `spyOn` from `bun:test` (no `vi` prefix).

### Biome
- Formatting: 2-space indent, double quotes, trailing commas, 100-char line width.
- Run `bun run lint:fix` to auto-fix formatting before checking for remaining issues.
- Use `// biome-ignore lint/<rule>: <reason>` only when strictly necessary and the comment must be on the line immediately before the violation.

### Tests
- Every new module must have a co-located `.test.ts` / `.test.tsx` file.
- Use an in-memory SQLite DB for all DB tests: `new Database(":memory:")` with `runMigrations()` in `beforeEach`.
- Clean up with `db.close()` in `afterEach`.
- Test files live alongside source files (`src/db/queries.test.ts`, not a separate `__tests__` directory).

## PR checklist

- [ ] Work is tracked by a GitHub issue (create one if not specified)
- [ ] `AGENTS.md` and `README.md` updated if needed
- [ ] `bun run test` passes
- [ ] `bun run lint` is clean
- [ ] `bun run build` succeeds
- [ ] PR title follows Conventional Commits (`feat:`, `fix:`, `ci:`, etc.)
- [ ] PR is linked to the **Burp - CLI RSS Reader** GitHub project (`--project "Burp - CLI RSS Reader"` on `gh pr create`)
- [ ] PR body references the closing issue (`Closes #N`)
