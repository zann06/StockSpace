# Contributing to StockSpace

Thanks for your interest in contributing! This project follows the phased plan
in [`PRD.md`](PRD.md); [`docs/implementation-checklist.md`](docs/implementation-checklist.md)
tracks what is done and what is next.

## Setup

```bash
git clone https://github.com/<your-fork>/stockspace.git
cd stockspace
npm install
npm run dev        # http://localhost:5173
```

Node.js ≥ 20.19 is required (`.nvmrc` pins 22: `nvm use`).

## Development workflow

1. **Branch** from `main`: `feat/<short-name>`, `fix/<short-name>`, or
   `docs/<short-name>`.
2. **Commit messages** — use Conventional Commits:
   `feat: add stock-out validation`, `fix(dashboard): correct KPI rounding`,
   `docs: expand deployment guide`, `chore(ci): cache npm`.
3. **Keep changes focused.** One logical change per pull request.
4. **All quality gates must pass** before you open a PR:

   ```bash
   npm run format         # Prettier (run this first)
   npm run lint           # ESLint
   npm run typecheck      # tsc, strict mode
   npm run test           # Vitest
   npm run build          # production build
   ```

   CI (`.github/workflows/ci.yml`) runs the same gates on every push and PR.

## Code conventions

- **TypeScript strict**; avoid `any` and non-null assertions unless there is no
  alternative (add a comment when you must).
- **React**: function components + hooks only. Derive state from URL/data
  where possible instead of syncing with effects. Respect
  `react-hooks` lint rules — they are errors, not warnings.
- **Styling**: Tailwind CSS v4 design tokens defined in `apps/web/src/index.css`
  (`bg-primary`, `text-ink`, `border-line`, …). Do not introduce one-off hex
  colors; extend the theme instead.
- **UI text is Indonesian (id-ID)**; code, comments, and docs are English.
- **Accessibility is not optional**: labelled controls, keyboard paths for
  every interaction, visible focus states, colour never the only signal.
- **Demo data stays in `apps/web/src/mocks/`** — production modules must never
  import from the mocks directory.
- 3D code: keep geometry procedural/original; record attribution if you ever
  add a third-party asset (must be redistribution-safe).

## Testing expectations

- Pure logic (stock math, reorder thresholds, formatters) lives in
  `apps/web/src/lib/` and gets unit tests.
- Business rules from `PRD.md` §13 (no negative stock, atomic transfers, …)
  are tested as soon as the backend exists; the same invariants are asserted
  against the mock dataset today.
- New UI components that render data should come with a component test
  covering at least their empty and populated states.

## Pull request checklist

- [ ] Branch is up to date with `main`
- [ ] `npm run format && npm run lint && npm run typecheck && npm run test && npm run build` all pass locally
- [ ] Tests added/updated for the change
- [ ] No secrets, credentials, or real business data in the diff
- [ ] Docs updated (README / docs/) when the change affects setup or behaviour
- [ ] UI text stays id-ID and respects the design tokens

## Reporting bugs / requesting features

Use the GitHub issue templates (bug report / feature request). For security
issues, follow [SECURITY.md](SECURITY.md) instead of public issues.

## Code of conduct

By participating you agree to uphold the [Code of Conduct](CODE_OF_CONDUCT.md).
