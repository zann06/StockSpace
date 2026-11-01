# Contributing to StockSpace

Thanks for your interest in contributing! The [README](../README.md) is the
single source of truth for the product, architecture, database, 3D warehouse,
and deployment. This file covers the contributor workflow.

## Setup

```bash
git clone https://github.com/<your-fork>/StockSpace.git
cd stockspace
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed

npm run dev        # web at http://localhost:5173
npm run dev:api    # API at http://localhost:4000
```

Node.js ≥ 20.19 is required (`.nvmrc` pins 22: `nvm use`). Docker is needed for
PostgreSQL; the API integration tests use a separate `stockspace_test`
database.

## Development workflow

1. **Branch** from `main`: `feat/<short-name>`, `fix/<short-name>`,
   `docs/<short-name>`, or `chore/<short-name>`.
2. **Commit messages** — use Conventional Commits:
   `feat: add stock-out validation`, `fix(dashboard): correct KPI rounding`,
   `docs: consolidate documentation`, `chore(ci): cache npm`.
3. **Keep changes focused.** One logical change per pull request.
4. **All quality gates must pass** before you open a PR:

   ```bash
   npm run format         # Prettier (run this first)
   npm run lint           # ESLint
   npm run typecheck      # tsc, strict mode
   npm run test           # Vitest (API tests need PostgreSQL)
   npm run build          # production build
   npm run test:e2e -w apps/web   # Playwright smoke + axe (UI changes)
   ```

   CI (`.github/workflows/ci.yml`) runs the same gates on every push and PR.

## Code conventions

- **TypeScript strict**; avoid `any` and non-null assertions unless there is no
  alternative (add a comment when you must).
- **React**: function components + hooks only. Derive state from URL/data
  where possible instead of syncing with effects. Respect `react-hooks` lint
  rules — they are errors, not warnings.
- **Styling**: Tailwind CSS v4 design tokens defined in
  `apps/web/src/index.css` (`bg-primary`, `text-ink`, `border-line`, …). Do not
  introduce one-off hex colours; extend the theme instead.
- **UI text is bilingual** via the i18n catalog (`apps/web/src/i18n`): write the
  Indonesian source string in the component wrapped in `t('…')` **and** add its
  English entry to the `en` catalog. Code, comments, and docs are English.
- **Accessibility is not optional**: labelled controls, keyboard paths for
  every interaction, visible focus states, colour never the only signal.
- **Demo data stays in `apps/web/src/mocks/`** — production modules must never
  import from the mocks directory.
- **3D code**: keep geometry procedural/original; record attribution if you
  ever add a third-party asset (it must be redistribution-safe). Respect
  `prefers-reduced-motion` and keep the non-WebGL fallback working. NPCs use
  fixed safe waypoint loops rather than dynamic pathfinding.
- **Documentation**: update the README when a change affects setup, behaviour,
  architecture, or the 3D scene. Do not add new top-level `.md` files; put
  contributor/community files in `.github/` if they are GitHub-recognised.

## Testing expectations

- Pure logic (stock math, reorder thresholds, formatters, route planning) lives
  in `apps/web/src/lib/` and gets unit tests.
- Business invariants (no negative stock, atomic transfers, workspace
  isolation) are tested in the API integration suite.
- New UI components that render data should come with a component test
  covering at least their empty and populated states.
- 3D changes should keep the reduced-motion and WebGL-fallback paths intact;
  route changes should keep the clearance tests green.

## Pull request checklist

- [ ] Branch is up to date with `main`
- [ ] `npm run format`, `lint`, `typecheck`, `test`, `build`, and (for UI
      changes) `test:e2e -w apps/web` all pass locally
- [ ] Tests added/updated for the change
- [ ] No secrets, credentials, or real business data in the diff
- [ ] README or `.github/` docs updated when setup/behaviour changes
- [ ] UI text stays id-ID/EN and respects the design tokens
- [ ] Accessibility preserved (labels, keyboard paths, focus states)
- [ ] 3D changes respect reduced motion and the WebGL fallback

## Good first issues

Look for issues labelled `good first issue` or `documentation`. Small,
well-scoped fixes (copy, tests, accessibility, demo data) are genuinely useful
and easy to review.

## Reporting bugs / requesting features

Use the GitHub issue templates (bug report / feature request). For security
issues, follow [SECURITY.md](SECURITY.md) instead of public issues.

## Code of conduct

By participating you agree to uphold the
[Code of Conduct](CODE_OF_CONDUCT.md).
