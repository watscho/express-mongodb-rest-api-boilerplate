# Architecture and ownership

The project is a modular API organized around cohesive application domains. It uses explicit functions/services and MongoDB transactions, without a general-purpose repository hierarchy or dependency-injection container.

For implementation instructions, follow the [developer guide](development.md), which builds a documented example domain and shows every registration point. Use the [QA and release handoff guide](handoff.md) when transferring changes for acceptance.

| Owner                    | Responsibilities                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `auth`                   | Credentials, bearer tokens, revocation, password workflows, sensitive account orchestration                |
| `auth/verification`      | Issue/replace/consume/invalidate email verification, token persistence, request/confirmation HTTP adapters |
| `users`                  | Account/profile persistence, public account DTOs, credential lookup, versioned mutation locks              |
| `media`                  | Owned image ingestion, processing, avatar attachment, storage paths and cleanup                            |
| `notifications`          | Template catalog, email-local translations/rendering, notification API                                     |
| `notifications/delivery` | Encrypted transactional outbox, retries, fenced leases, worker heartbeats, operator metadata               |
| `app/config`             | Narrow validated process configuration and secret-file loading                                             |
| `app/database`           | Connections/pools and transaction entrypoint                                                               |
| `app/http`               | Composition, HTTP envelopes, middleware, OpenAPI assembly and Swagger routes                               |
| `app/runtime`            | API/worker lifecycles, logging, compiled operator commands                                                 |

Verification and delivery remain features inside their parent domains. Confirmation is coupled to account identity/token invalidation; mail delivery is coupled to notification rendering and policy. Separate worker execution does not imply a new top-level business domain.

## Data boundaries

`schemas.ts` defines runtime Zod contracts and `dto.ts` derives compile-time types. DTO type annotations do not transform values or remove extra fields. Controllers accept parsed transport DTOs, services coordinate workflows, and repositories perform persistence. An optional `transformer.ts` handles meaningful format conversion, normalization, or explicit selection across a persistence/public boundary. Domain-local `utils.ts` holds reusable helpers. Native persistence snapshots/third-party protocol types are adapted through DTO aliases rather than requiring hydrated documents on every read.

### Schema and DTO ownership

Keep each contract in its owning domain, and reuse it directly when validation and meaning match. Sign-in and email change use auth's `credentialsSchema` / `CredentialsDto`; reset and verification requests use `emailRequestSchema` / `EmailRequestDto`. Verification also reuses its parent's token parameters. Updating a profile returns `UpdateProfileDto`, and upload ingestion accepts `StoredImageDto`; neither needs a second name for the same shape.

Derive variants with `pick`, `omit`, or `extend` and reuse field validators or enum subsets where the invariants are shared. Email-token issuance shares its opaque-token/expiry contract, delivery creation/claims reuse delivery fields, and worker persistence uses `workerStatusSchema.options`. Keep intentional differences: current-password input, new-password policy, and stored bcrypt hashes have different constraints; internal `Date` values and JSON ISO timestamps have different formats. Defaults, coercion, nullability, unknown-key handling, and refinements are also part of a contract.

Use `z.infer` / `z.output` for parsed data and `z.input` for values accepted before defaults, coercion, or transforms. Notification registration/enqueue inputs and queue-list options use input types; prepared notifications have normalized language and populated variables. Configuration profiles are inferred by `loadEnvironment` as `Readonly<z.output<Schema>>`, without unused parallel environment DTO declarations.

Native Mongoose snapshots, sessions/connection options, Express request/response generics, OpenAPI compatibility types, and template-validator instances remain based on their library types. Do not invent runtime schemas merely to derive those types. Keep implementation-only aliases private and remove unused exports. An inferred DTO is not runtime validation, serialization, or an authorization check; route/service adapters still parse untrusted input explicitly.

### When a transformer is useful

Keep a transformer for ObjectId-to-string conversion, Date-to-ISO serialization, null normalization, upload adaptation, or a deliberate public-field allowlist that excludes credentials/internal metadata. Do not add one just to wrap `{ accessToken }`, assemble an auth context, or copy two already prepared response fields. Build those small objects in the owning service, middleware, or worker, with an explicit DTO return type or `satisfies` where useful.

| Owner                        | Retained transformation                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `auth` / `auth/verification` | Token document owner IDs become string DTO IDs; persistence-only fields are omitted                       |
| `users`                      | Account/credential snapshots, normalized optional fields, public account serialization and ISO timestamps |
| `media`                      | Multer file adaptation, MIME validation, safe stored paths, owned-image IDs                               |
| `notifications/delivery`     | Public job metadata with ISO timestamps and a restricted worker claim snapshot                            |
| `app/http`                   | Zod issues become safe field-error keys/parameters                                                        |

The notification domain has no root transformer: its worker assembles the SMTP message directly at submission. HTTP envelope creation lives in `app/http/response.ts` (`respond`, `createErrorResponse`, and default status keys), while `app/http/transformer.ts` contains validation-issue conversion. Reused envelope construction stays centralized; simple domain object assembly needs no extra layer.

A domain calls another domain through its `index.ts`, or imports public `dto.ts`/`schemas.ts`. Nested features use the same rules for cross-domain dependencies. HTTP router/documentation composition and administrative model maintenance have explicit adapter access. ESLint encodes these boundaries; the local lint check passed.

Public account DTOs omit hashes/version counters. Public delivery DTOs omit recipient/content/ciphertext/fingerprint. API envelopes use translation keys; email content is localized on the server. HTTP status codes remain the primary outcome category.

## Services and repositories

Services own business rules, permission/version checks, and transaction orchestration. Repositories own queries, projections, session propagation, and persistence-result adaptation. A repository may return a domain DTO directly when that is the supported persistence boundary; it need not return a Mongoose document only for a service to wrap and convert it again.

The user repository returns account/credential DTOs, booleans for existence checks, and `void` for commands whose database result is not part of the contract. `userService` exposes these operations through direct function references; only current-account validation and profile mutation add service logic. Public profile serialization happens in the controller through its local transformer, without a `me` forwarding method.

Keep a public domain facade when it controls cross-domain access. A direct reference such as `getById: userRepository.getById` adds no forwarding function and does not expose the repository module. Do not replace domain APIs with cross-domain model/repository imports, spread every repository method into a public API, or introduce a generic repository/CRUD framework to remove a few lines.

Account email delivery has one `notificationService.enqueueAccount(template, options, session)` operation. It applies owner/purpose/variable policy to the eight built-in keys from `accountTemplateSchema`. Custom workflows use `enqueueTemplate`; catalog metadata comes from the public `listEmailTemplates` function. `sendTemplate` and the eight one-template convenience methods have been removed. HTTP endpoints/envelopes are unaffected by this internal API cleanup.

Shared password-link invalidation stays in the auth service, where its ordered token deletion and pending-job cancellation form a business operation. Media ownership checks return booleans when callers need only existence. Token consumption, avatar replacement, queue fencing, retries, and account transaction locks remain explicit operations rather than being flattened into generic helpers.

## Controllers and middleware

Routes and OpenAPI stay explicit, with one owning domain per operation. Auth composes both verification routes and verification documentation. Shared documentation helpers derive path parameters from the route's Zod schema, requests from input contracts, and responses from output contracts. Access metadata distinguishes authenticated, guest-only, and public application routes; it describes the guards rather than installing them. The email-language header flag adds no transaction claims. See [OpenAPI maintenance](openapi.md#maintaining-the-reference).

Controllers adapt HTTP input, authenticated context, and headers to business operations, then serialize the result. Keep this adaptation explicit; a shared controller factory or async-handler wrapper is unnecessary with Express 5. A single small operation can live directly in its domain router, as the template-catalog handler does. Do not create a controller object/file merely to move one inline response into another module.

`respond(res, messageKey, data?, status = 200)` requires the semantic success key, defaults the HTTP status, and omits absent data. No-data operations call `respond(res, 'domain.completed')` after awaiting the service; they need no repeated `undefined, 200` arguments. Error envelopes retain their centralized status-key fallback in `createErrorResponse`.

The global auth middleware resolves optional credentials. Route guards enforce mandatory/guest access; `authGuard.isAuth` delegates its presence check to `getAuth`, which also returns the typed context to controllers. Keep token verification, revocation/version checks, route validation, and limiter order explicit. A function that adapts a middleware signature or binds a stateful client is not an unnecessary forwarding wrapper.

The final 404 fallback is composed inline in `app/http/app.ts` before the error middleware. Cache policy is also composed there: health responses are non-cacheable, public conversions retain their own cache settings, and subsequent API/docs responses receive `no-store`. The documentation router reuses this policy instead of mounting a duplicate setter. Error handling sets `no-store` independently because errors from static-resource handling can occur before the general API policy.

## Utilities and ownership

Keep small reusable policy/helpers in a domain-local `utils.ts`. Give substantial I/O adapters or workflows their own descriptive module; do not hide image processing, rendering, or lifecycle work in a general utility collection.

| Module                                                                                | Responsibility                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`auth/utils.ts`](../src/domains/auth/utils.ts)                                       | Shared email-token generation, token digests, configured password hashing, JWT signing/verification |
| [`media/utils.ts`](../src/domains/media/utils.ts)                                     | Media storage root, root-bound paths, public conversion URLs                                        |
| [`media/image.ts`](../src/domains/media/image.ts)                                     | Decode validation, the single avatar conversion, atomic file publication and cleanup                |
| [`notifications/utils.ts`](../src/domains/notifications/utils.ts)                     | Pure email-language preference matching with explicit defaults                                      |
| [`notifications/preparation.ts`](../src/domains/notifications/preparation.ts)         | Input/template-variable validation and locale selection before enqueue/render                       |
| [`notifications/renderer.ts`](../src/domains/notifications/renderer.ts)               | Template-file initialization, isolated translations, HTML/text rendering                            |
| [`notifications/mailer.ts`](../src/domains/notifications/mailer.ts)                   | SMTP transport lifecycle and provider-failure classification                                        |
| [`notifications/delivery/utils.ts`](../src/domains/notifications/delivery/utils.ts)   | Queue payload encryption/decryption and canonical HMAC fingerprinting                               |
| [`notifications/delivery/worker.ts`](../src/domains/notifications/delivery/worker.ts) | Consumer orchestration, private retry timing, leases and heartbeats                                 |
| [`app/runtime/paths.ts`](../src/app/runtime/paths.ts)                                 | Project-root resolution and the shared lexical root-containment check                               |
| [`app/http/documentation/utils.ts`](../src/app/http/documentation/utils.ts)           | Shared JSON Schema/OpenAPI operation construction                                                   |

`createEmailToken(lifetimeDays)` owns the common 48-byte random token and expiry construction. Reset/verification services own their respective one-/seven-day lifetimes and workflow DTO assembly; there is no separate verification utility wrapper. Password comparison uses bcrypt directly, while `hashPassword` retains the configured work-factor policy. Bearer-header parsing stays in the auth middleware.

Image decode options and the conversion filename have one definition in the media adapter. `Image.resize()` creates only the supported avatar variant, matching cleanup. Media/template paths use the same application-owned lexical containment primitive; domain adapters preserve their own storage root and error semantics. This check does not resolve symlinks; templates and storage remain server-owned directories.

Queue idempotency IDs are generated at enqueue time, retry timing belongs to the worker, and SMTP classification belongs to the mail adapter. Auth token hashes, historical migration hashing, and delivery fingerprints/IDs serve different contracts; they are not merged into a global crypto helper. The legacy migration continues using Node crypto directly so it does not import live JWT/Redis configuration.

## Transaction boundaries

Account security workflows acquire a user mutation lock and persist account/token/outbox changes in one MongoDB transaction. Transaction callbacks may be retried by the driver; their work consists of database operations plus local validation/encryption, never SMTP or filesystem deletion.

Verification issuance receives the caller's session for signup/email changes rather than opening a nested transaction. Token replacement updates the existing user-keyed record and queues the matching link atomically. Consuming tokens checks expiration, mutates account state, invalidates obsolete credentials/links, and queues notifications before commit.

The API signs replacement JWTs after commit. Worker rendering/SMTP and media cleanup happen outside database transactions. Filesystem cleanup remains best effort; a durable file cleanup/outbox would be a distinct future feature rather than an assumed guarantee.

## Delivery boundary

Jobs store encrypted input, a template key, a chosen locale, safe operational metadata, and an expiry. The worker resolves deployed templates and submits HTML/plain text using bounded SMTP connections. Claims and acknowledgements are fenced by job/lease identity and expiry. Retry scheduling is persisted, with no second broker write between the business transaction and the queue.

This preserves committed work across crashes subject to explicit expiry/budget limits. SMTP has no portable exactly-once acceptance/acknowledgement transaction with MongoDB; stable Message-ID and enqueue idempotency reduce duplicate work without promising deduplicated inbox delivery.

## Process boundary

API and worker entrypoints use `app/runtime/bootstrap.ts` before dynamically loading their implementations. Configuration profiles are loaded together for the selected role and aggregated on failure; successful imports are reused through ESM caching. Pure diagnostics in `app/runtime/diagnostics/` work without initialized clients or Winston. The worker entrypoint remains `app/runtime/mail/worker.ts`, with lifecycle code in `mail/process.ts`. CLI bootstrap preserves narrow profiles, stdout results, and credential-free help. See [runtime diagnostics](logging.md).

API and worker load only their own configuration profiles. Queue diagnostics do not need decryption or API signing credentials. OpenAPI generation consumes pure schemas and package metadata without connecting to services. Operational commands have compiled entrypoints, enabling a runtime image with production dependencies only.

The source imports `.ts` paths. TypeScript emission rewrites relative extensions, preserving a standard ESM runtime in `dist/`. Runtime paths resolve from project/module locations rather than the working directory. Templates and uploads have distinct lifecycles: builds copy templates and replace `dist/`, while uploads live on persistent storage.
