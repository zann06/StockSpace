# Security Policy

## Supported versions

The project is pre-1.0 and under active development. Security fixes are applied
to the latest `main` branch only.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email the maintainers at **security@stockspace.example** (replace with the
address published on the repository's GitHub Security tab when the project goes
public). Include:

- a description of the issue and its impact,
- steps or a proof-of-concept to reproduce it,
- affected versions/commit hashes,
- any suggested mitigation.

You will get an acknowledgement within 7 days. Please avoid public disclosure
until a fix is released; we will credit reporters in the release notes unless
you prefer to remain anonymous.

**Never include real credentials, API keys, or customer data in a report.**

## Scope notes

- The application is currently Phase 1 (frontend + demo data); authentication
  and the API land in Phases 2–4. Reports about missing authentication are
  already tracked — see `docs/implementation-checklist.md`.
- The development seed account (when introduced in Phase 4) is for local
  development only and must never be enabled in production.

## Best practices we follow

- Secrets only via environment variables; `.env.example` carries placeholders.
- Input validation with Zod on every external boundary (server-side).
- Parameterized queries via Prisma.
- Append-only stock movement history; corrections via compensating adjustments.
- Rate limiting on authentication endpoints (Phase 4).
