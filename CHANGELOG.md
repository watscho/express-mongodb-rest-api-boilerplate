# Changelog

This file describes prepared repository changes. Version metadata does not imply that a Git tag, published image, deployment, or production acceptance has occurred.

## 2.0.0 — 2026-11-01

### Breaking changes

- Migrate Yarn Classic to pinned Yarn 4.18.1 with the modern lockfile, node-modules linker, immutable installs, and production workspace focus.
- Require Node.js 26.13.0+ within major 26, TypeScript 7 compilation, ESM output in `dist/`, and MongoDB replica-set transactions.
- Replace API message text with stable `messageKey` values and structured validation keys/parameters. Clients supply translations.
- Strengthen JWT claims/versioning; password/email changes and verification return replacement credentials and invalidate earlier tokens.
- Hash single-use email tokens at rest and enforce one reset/verification token per account. New unique indexes require legacy-data reconciliation.
- Enforce owned media, serialized avatar attachment, private originals, and generated 150×150 WebP public conversions.
- Persist account-triggered email jobs in the business transaction. Replace generic `sendTemplate` with `enqueueTemplate`, which returns a receipt rather than awaiting SMTP; consolidate built-in account methods into `enqueueAccount`.
- Require a persistent shared `MAIL_QUEUE_ENCRYPTION_KEY` for API/worker producers/consumers and deploy a separate email-worker process.
- Rename template folders to kebab-case while retaining camelCase service/job keys.
- Replace legacy watch/format/lint script aliases with documented canonical commands. See migration instructions before upgrading.

### Added

- Developer onboarding and an illustrative domain guide, client integration/route reference, documentation index, QA handoff, and incident/restore procedures.

- Domain-based structure with DTOs, Zod schemas, transformers, local utilities, and import boundaries.
- Nested email-verification and notification-delivery features with cohesive ownership.
- Encrypted MongoDB transactional outbox, bounded retries with jitter, fenced/renewed leases, expiry, cancellation, idempotent enqueue, manual retry, and payload retention.
- Worker heartbeat records, metadata-only health, queue statistics, and cursor-paginated administration CLI.
- Eight lightweight HTML/plain-text email templates, shared layout/partials, English/Georgian copy, per-message dictionaries, and Accept-Language selection.
- OpenAPI 3.1.2 definitions generated from DTO schemas, locally hosted Swagger UI, production docs credentials, and independently gated interactive submission.
- Pure OpenAPI export and compiled production operator entrypoints.
- Narrow API/MongoDB/mail/queue/runtime configuration, `_FILE` secrets, configurable connection pools, and explicit failure deadlines.
- Multi-stage non-root Docker image, separate API/worker/operations services, persistent uploads, health definitions, and role-specific environment samples.
- Detailed architecture, configuration, database, operations, deployment, OpenAPI, template, and migration documentation.

### Changed

- Commit the official Yarn release/license, keep caches/install state ignored, and invoke the same CLI explicitly in Docker build stages. Retain Node entrypoints in the final runtime image.
- Remove the observed Classic DEP0169 metadata-parsing path through project-local delegation; document manager setup and flag migration.
- Fix Yarn YN0066 by replacing the TypeScript 6 re-export shim with the already-used full SDK pinned at 6.0.3; retain the native TypeScript 7.0.2 build/typecheck compiler. Confirm a warning-free immutable install with empty caches and dependency builds skipped.
- Add role-aware bootstrap that aggregates configuration failures before client imports, preserving credential-free help and pure OpenAPI export.
- Provide readable development console output, sanitized production/file JSON, stderr error/warning records, safe exception source locations, and actionable dependency/configuration/CLI diagnostics.
- Add HTTP route-pattern/request context, MongoDB disconnect/recovery and Redis recovery diagnostics, and readable worker/delivery/shutdown failures without changing API envelopes or delivery policies.
- Document logging categories, stream changes, process registration, migration, and the limits of unexecuted runtime acceptance.

- Align Swagger access modes, path-parameter schemas, JSON/form/multipart bodies, response output schemas, parser/policy failures, headers, and exact readiness payloads with HTTP handlers.
- Compose verification documentation inside auth, share sign-out operation metadata and specification-serving callbacks, and replace special token/language side effects with explicit metadata.
- Update the developer examples, client integration notes, and migration guidance for the documentation helper; document implicit HEAD behavior on legacy state-changing GET routes.

- Reuse canonical credentials, email-request, token-parameter, profile, and stored-image contracts; remove redundant DTO/schema aliases and unused environment/notification exports.
- Derive token, account-creation, and delivery variants from existing Zod schemas; share boolean/pagination validators and worker enum values. Keep parsed output distinct from pre-parse input and preserve native library adapters.
- Document schema ownership, inference/composition rules, intentional validation differences, and custom-code import migration.

- Keep utilities scoped to their owners: move image processing to `media/image.ts`, notification preparation/rendering into named notification modules, SMTP failure classification to the mail adapter, and retry timing into the worker.
- Share lexical file-root containment through `app/runtime/paths.ts`, consolidate email-token generation, remove trivial comparison/header/verification/delivery-ID wrappers, and keep conversion naming/decode options in one place.

- Keep controllers for HTTP adaptation, inline the single template-catalog handler and final 404 fallback, share the auth-presence check, and reuse centralized error-key/cache policy.
- Simplify success responses to `respond(res, messageKey, data?, status = 200)` and update every controller and development example; existing endpoint envelopes/keys are retained.

- Remove user-service forwarding functions by returning domain DTOs from user persistence operations and composing the public facade with direct function references. Serialize profiles directly through the local transformer.
- Consolidate eight account-notification wrappers into typed `enqueueAccount`, share its manifest with template registration, expose catalog metadata through `listEmailTemplates`, and remove the duplicate `sendTemplate` alias.
- Share password-link invalidation between password-change/reset workflows, return explicit booleans for media ownership checks, and keep driver command results inside repositories.

- Keep transformers for ID/date conversion, normalization, and persistence/public field boundaries. Inline trivial token/context/profile/upload/receipt/SMTP assembly, remove the root notification transformer, and centralize HTTP envelope construction in `app/http/response.ts`.

- Use lean projected account/media snapshots on read paths and exclude outbox ciphertext/fingerprints by default.
- Match queue claim/recovery/list sorts to dedicated indexes; add token uniqueness and owner/attachment indexes and TTL indexes for worker metadata.
- Preflight duplicate groups before additive index maintenance, without automatic deletion or index dropping.
- Keep startup/model DDL off by default; database maintenance commands are explicit and independently deployable.
- Update package description/metadata, license attribution, pinned dependencies, README, and tooling configuration.

### Implementation status

Dependency installation and lockfile updates completed with lifecycle scripts disabled. Local TypeScript 7 typecheck, build, ESLint, and Prettier checks passed under Node.js 26.13.0 after separate user authorization. Added a dedicated `typecheck` command, aligned transitive Express types with Express 5, and corrected Mongoose inference, queue filter literals, and OpenAPI 3.1 type adapters. The compiled exporter generated a temporary OpenAPI artifact with 18 operations across 17 paths; static method/path inventory matched the source registrations. No tests were added/run. Services, containers, database maintenance/probes, HTTP/SMTP probes, Swagger UI, generated clients, and actual email delivery were not executed. Runtime/index/container/SMTP qualification remains outstanding and requires an explicitly authorized operational phase.

See [migration](docs/migration.md) for the 1.x transition and [deployment](docs/deployment.md) for operator responsibilities.
