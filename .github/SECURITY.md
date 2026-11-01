# Security Policy

## Supported versions

The project is pre-1.0 and under active development. Security fixes are applied
to the latest `main` branch only.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Use **GitHub's private vulnerability reporting**: open
<https://github.com/zann06/StockSpace/security/advisories/new> and file a
private report (preferred), or email the maintainer listed on the repository's
Security tab. Include:

- a description of the issue and its impact,
- steps or a proof-of-concept to reproduce it,
- affected versions/commit hashes,
- any suggested mitigation.

You will get an acknowledgement within 7 days. Please avoid public disclosure
until a fix is released; we will credit reporters in the release notes unless
you prefer to remain anonymous.

**Never include real credentials, API keys, or customer data in a report.**

## Scope notes

The application includes a Fastify API, PostgreSQL persistence, better-auth
sessions, workspace membership, and server-side roles. Reports of particular
interest include:

- authentication/session bypass, cookie or CSRF issues,
- workspace isolation failures (reading or mutating another workspace's data),
- privilege escalation between VIEWER / STAFF / ADMIN / OWNER,
- stock-consistency bugs that allow negative balances or overselling,
- injection, XSS, or unsafe rendering of user-controlled strings,
- rate-limit bypasses on auth or movement endpoints.

The development seed accounts are for local development only and must never be
enabled in production.

## Best practices we follow

- Secrets only via environment variables; `.env.example` carries placeholders.
- Input validation with Zod on every external boundary (server-side).
- Parameterized queries via Prisma.
- Append-only stock movement history; corrections via compensating adjustments.
- HTTP-only cookie sessions, deliberate CORS configuration, and server-side
  role checks on every write route.
- Rate limiting on authentication endpoints (20/min), movements (60/min), and a
  global 300/min budget, returning 429.
