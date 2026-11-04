# Testing

Run `yarn test` from the project root. It builds the TypeScript application, copies email templates, and runs Node's test runner against colocated application and tooling tests. No additional test framework or running MongoDB, Redis, SMTP service is required. The pinned Node.js version is required; module mocks use Node's experimental `--experimental-test-module-mocks` API.

Tests are colocated with the code they check. For example, auth service tests are in `src/domains/auth/__tests__/service.test.mjs`, and delivery tests are in `src/domains/notifications/delivery/__tests__`. Shared doubles and environment initialization are in `src/__tests__`. Plain ESM test files keep test helpers out of the emitted TypeScript application. Tests exercise built JavaScript; `yarn test` rebuilds it on every run.

The setup ignores developer `.env` values and supplies deterministic test-only secrets and unreachable service addresses. External clients are replaced with module doubles. Image conversion tests use real Sharp against temporary files and remove their directory afterward. Each test file runs in its own Node process; mutable mocks reset between cases. The shared launcher bounds execution to four test files at once and a 30-second timeout per test. Configuration probes receive only the required launch flags, rather than inheriting internal Node test-worker flags.

## Scope

The suite checks configuration bounds and secret-file diagnostics, account and verification services, JWT/password utilities, authorization guards, repository query predicates and session forwarding, profile/media transformations, image conversion and cleanup, locale negotiation, all built-in email templates in English and Georgian, queue encryption/idempotency, queue administration, worker retry/expiry/cancellation and acknowledgement behavior, HTTP errors and validation, request IDs, OpenAPI, startup orchestration, and connection diagnostics.

Repository doubles verify query construction and failure handling. They do not simulate MongoDB transaction isolation, unique indexes, TTL timing, or concurrent lease acquisition. Real-service acceptance remains a separate check. Process entrypoints and CLI/lifecycle behavior are tested with controlled dependency doubles. Deployment scripts and external-provider delivery remain separate checks.

## Enforced coverage

`yarn test:coverage` builds the application, instruments **every emitted JavaScript module from `src`** with Istanbul, runs the suite, merges process-local counters, and fails unless statements, branches, functions, and lines are all 100%. Unloaded modules start at zero; mocked dependencies do not count as executions of their real implementation. No application files or branches are excluded. Type-only modules have no executable statements. Tests, test fixtures, dependency code, and build/coverage tooling are outside the application coverage denominator.

The preload hook serves instrumented code only inside test processes. It preserves original module URLs and leaves `dist` and running services untouched. Reports are generated in ignored `coverage/`: `index.html`, `coverage-summary.json`, `coverage-final.json`, `lcov.info`, `gaps.json`, and `manifest.json`. The manifest records the Node version, timestamps, process result, source/module counts, and SHA-256 hash of each compiled module. Raw counters and instrumented copies live in a unique temporary directory and are removed after reporting. The previous report remains available until its replacement has been generated. The normal `yarn test` run uses uninstrumented built modules. For investigation without enforcing the threshold, run `yarn test:coverage:report`. The lower-level `node scripts/coverage.mjs --report-only` requires a current build. The runner checks that every application TypeScript module has a compiled counterpart; an incomplete build fails before testing.

On 2026-11-04 the complete source inventory initially measured 67.47% lines and 73.65% branches. The expanded suite has **375 passing tests** (369 application tests and six tooling tests), covering **1,526/1,526 lines, 1,592/1,592 statements, 319/319 functions, and 909/909 branches**. It includes HTTP pipeline/route/controller tests, process startup/shutdown and CLI tests, and deterministic worker timer/abort races. Several unreachable fallback expressions were removed where earlier validation or JavaScript guarantees already established the invariant (known duration units, nonempty `split()` results, validated locales, unique object keys).

The 100% threshold establishes execution of application statements and branch arms with assertions around tested behavior. It does not establish production acceptance, MongoDB concurrency guarantees, or absence of all defects.

## Quality gate and CI

Run `yarn check` before handing off a change. It stops at the first failure and runs formatting, ESLint, and the coverage suite. The suite performs one TypeScript build, which checks application types and copies templates before testing. No global Yarn launcher is required: the scripts call the committed Yarn release or Node directly. Commands rebuild the shared `dist` directory, so run one quality/test command at a time per checkout.

The GitHub Actions Quality workflow uses the pinned Node version and an immutable dependency installation, then runs the same command on pushes and pull requests. Its permissions are limited to reading repository contents. Official actions are pinned to commit SHAs, with Dependabot configured for weekly action updates. Coverage reports are retained as a CI artifact for 14 days. Adding the workflow does not establish that a hosted CI run has passed; inspect the actual run after pushing.

Tooling tests cover zero-execution modules, missing build outputs, strict coverage counts (including percentages rounded to 100%), skipped code, subprocess failures, and shared launch arguments. Test infrastructure is in `scripts/testing`, separate from the ignored root `/coverage/` directory. Generated reports and `__tests__` directories are excluded from the Docker build context.

## Local runtime verification — 2026-11-04

Before adding the unit suite, 53 HTTP/SMTP assertions passed against the compiled API and mail worker, using a new local MongoDB 8 replica set, dedicated Redis on port 6380, and Mailpit on SMTP port 1025 / UI port 8025.

Verified scenarios included liveness/readiness, Swagger/OpenAPI availability, validation and authentication errors, signup and duplicate signup, sign-in, profile updates, Georgian verification email, single-use verification, JWT invalidation, image upload/WebP/avatar ownership, password reset via captured email, single-use reset, password and email changes, logout revocation, account deletion, and removal of uploaded files. Account operations exercised real database transactions and indexes. Rate limiting returned 429 at the default threshold; the remaining scenarios ran with a temporary higher process-local test limit.

Mailpit acceptance establishes local SMTP submission and captured content. It does not establish delivery through an external provider or to a recipient inbox. No production deployment, legacy migration, or application-container build was performed.
