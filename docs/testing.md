# Testing

Run `yarn test` from the project root. It builds the TypeScript application, copies email templates, and runs Node's test runner against `src/**/__tests__/*.test.mjs`. No additional test framework or running MongoDB, Redis, SMTP service is required. The pinned Node.js version is required; module mocks use Node's experimental `--experimental-test-module-mocks` API.

Tests are colocated with the code they check. For example, auth service tests are in `src/domains/auth/__tests__/service.test.mjs`, and delivery tests are in `src/domains/notifications/delivery/__tests__`. Shared doubles and environment initialization are in `src/__tests__`. Plain ESM test files keep test helpers out of the emitted TypeScript application. Tests exercise built JavaScript; `yarn test` rebuilds it on every run.

The setup ignores developer `.env` values and supplies deterministic test-only secrets and unreachable service addresses. External clients are replaced with module doubles. Image conversion tests use real Sharp against temporary files and remove their directory afterward. Each test file runs in its own Node process; mutable mocks reset between cases.

## Scope

The suite checks configuration bounds and secret-file diagnostics, account and verification services, JWT/password utilities, authorization guards, repository query predicates and session forwarding, profile/media transformations, image conversion and cleanup, locale negotiation, all built-in email templates in English and Georgian, queue encryption/idempotency, queue administration, worker retry/expiry/cancellation and acknowledgement behavior, HTTP errors and validation, request IDs, OpenAPI, startup orchestration, and connection diagnostics.

Repository doubles verify query construction and failure handling. They do not simulate MongoDB transaction isolation, unique indexes, TTL timing, or concurrent lease acquisition. Real-service acceptance remains a separate check. Process entrypoints and CLI/lifecycle behavior are tested with controlled dependency doubles. Deployment scripts and external-provider delivery remain separate checks.

## Enforced coverage

`yarn test:coverage` builds the application, instruments **every emitted JavaScript module from `src`** with Istanbul, runs the suite, merges process-local counters, and fails unless statements, branches, functions, and lines are all 100%. Unloaded modules start at zero; mocked dependencies do not count as executions of their real implementation. No application files or branches are excluded. Type-only modules have no executable statements. Tests, test fixtures, dependency code, and build/coverage tooling are outside the application coverage denominator.

The preload hook serves instrumented code only inside test processes. It preserves original module URLs and leaves `dist` and running services untouched. Reports are generated in ignored `coverage/`: `index.html`, `coverage-summary.json`, `coverage-final.json`, and `gaps.json`. The normal `yarn test` run uses uninstrumented built modules. For investigation without enforcing the threshold, run `yarn build` followed by `node scripts/coverage.mjs --report-only`.

On 2026-11-04 the complete source inventory initially measured 67.47% lines and 73.65% branches. The expanded suite has **369 passing tests**, covering **1,526/1,526 lines, 1,592/1,592 statements, 319/319 functions, and 909/909 branches**. It includes HTTP pipeline/route/controller tests, process startup/shutdown and CLI tests, and deterministic worker timer/abort races. Several unreachable fallback expressions were removed where earlier validation or JavaScript guarantees already established the invariant (known duration units, nonempty `split()` results, validated locales, unique object keys).

The 100% threshold establishes execution of application statements and branch arms with assertions around tested behavior. It does not establish production acceptance, MongoDB concurrency guarantees, or absence of all defects.

## Local runtime verification — 2026-11-04

Before adding the unit suite, 53 HTTP/SMTP assertions passed against the compiled API and mail worker, using a new local MongoDB 8 replica set, dedicated Redis on port 6380, and Mailpit on SMTP port 1025 / UI port 8025.

Verified scenarios included liveness/readiness, Swagger/OpenAPI availability, validation and authentication errors, signup and duplicate signup, sign-in, profile updates, Georgian verification email, single-use verification, JWT invalidation, image upload/WebP/avatar ownership, password reset via captured email, single-use reset, password and email changes, logout revocation, account deletion, and removal of uploaded files. Account operations exercised real database transactions and indexes. Rate limiting returned 429 at the default threshold; the remaining scenarios ran with a temporary higher process-local test limit.

Mailpit acceptance establishes local SMTP submission and captured content. It does not establish delivery through an external provider or to a recipient inbox. No production deployment, legacy migration, or application-container build was performed.
