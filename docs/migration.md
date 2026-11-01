# Migrating from 1.x to 2.0.0

This guide describes upgrading an existing 1.x deployment, including version 1.0.3, to **2.0.0**. Version 2.0.0 is a breaking major release: it changes the API message contract, runtime, token claims, schema indexes, storage location, and email delivery architecture. Existing deployments require the configuration, data, client, and worker changes described below.

For a new installation with an empty database, follow the [Quick start](../README.md#quick-start); the legacy-data migration is only for existing deployments. Runtime and migration acceptance are tracked separately from [local tooling results](../README.md#validation-status).

## Cutover order

1. Review the client contract changes, new process roles, secrets, and storage paths before scheduling downtime.
2. Prepare the 2.0 artifact, compatible templates, and API/worker configuration. Keep the queue key persistent and separate from the JWT signing secret.
3. Stop all API/worker processes and other database writers. Take restorable database, Redis/revocation, and media backups, with separately protected secret recovery.
4. Reconcile malformed/duplicate legacy records, then run the legacy migration and additive index command in the order below. Copy legacy originals into the new persistent storage root.
5. Deploy the coordinated client/API/worker changes and complete the agreed [environment acceptance](handoff.md) before reopening public traffic. Existing JWTs require a fresh sign-in.
6. Record the deployed artifact and remaining limitations. If recovery is needed, follow [restore and rollback guidance](operations.md#restore-and-rollback) rather than reverting binaries alone.

## Runtime and tooling

1. Install/use Node.js 26.13.0 with `nvm install && nvm use`.
2. Use the committed Yarn 4.18.1 release and install pinned dependencies with `yarn install --immutable` (or `node .yarn/releases/yarn-4.18.1.cjs install --immutable`).
3. Merge `.env.example` into deployment configuration. Supply a random `JWT_SECRET` of at least 32 characters, explicit application/client URLs, and SMTP settings.
4. `REDIS_TOKEN_EXPIRATION` is no longer used; JWT expiration determines revocation lifetime. Runtime path aliases, `ts-node`, `ts-node-dev`, `tsc-alias`, and `email-templates` were removed.
5. `public/` is no longer a build output. Builds produce `dist/`; `yarn start` runs compiled JavaScript. Do not deploy `.env` with public assets.

Builds use **TypeScript 7.0.2**, installed as `@typescript/native`. Bare `typescript` directly pins the complete **6.0.3** JavaScript SDK for ESLint 10 and `typescript-eslint`, which still depend on the previous compiler API described in the [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/). The SDK replaces the `@typescript/typescript6` re-export shim and its indirect `@typescript/old` dependency, allowing Yarn's builtin TypeScript patch to apply correctly and removing YN0066. This does not replace or downgrade the TypeScript 7 build compiler. Current declarations and resolutions are recorded in `package.json` and `yarn.lock`.

### Yarn Classic to Yarn 4

`packageManager` and `.yarnrc.yml` pin Yarn 4.18.1, with the official CLI/license committed in `.yarn/releases/`. Existing Classic launchers delegate through `yarnPath`; a direct `node .yarn/releases/yarn-4.18.1.cjs <command>` invocation needs no global manager installation. This removes the observed Classic `url.parse(homepage)` / DEP0169 path without suppressing Node warnings.

The lockfile uses the modern Yarn format. Keep `nodeLinker: node-modules`, replace `--frozen-lockfile` with `--immutable`, and replace `install --production=true` with `workspaces focus --all --production`. Classic `--non-interactive` and `--ignore-scripts` flags are not the documented workflow; local lifecycle-free review uses `install --mode=skip-build`. Docker invokes the exact committed CLI and runtime containers use compiled Node entrypoints. See [tooling](tooling.md), including the TypeScript 7 compiler / TypeScript 6 JavaScript SDK separation.

## Domain Based source layout

Source code now lives under `src/app/` and `src/domains/{auth,users,media,notifications}/`. Each domain owns its schemas, DTOs, and local helpers; transformers exist only where conversion, normalization, or boundary field selection warrants them. Simple response assembly stays in services/middleware/workers, and common HTTP envelopes live in `app/http/response.ts`. Existing endpoint paths, collection names, storage configuration, and package entrypoints are preserved by this source organization; new token uniqueness, attachment, and queue indexes are separate schema changes described below.

The default email templates moved to `src/domains/notifications/templates/`; the build copies them to `dist/domains/notifications/templates/`. If `MAIL_TPL_PATH` was explicitly set to `src/templates` or a compiled `templates` directory, update it to the new domain-owned directory or remove the override to use the runtime default. Relative custom paths still resolve from the project root. English and Georgian resources live in the notification domain.

The `db:migrate:legacy` and `db:indexes` commands keep their names. Their source imports point to the owning domain models.

Email verification now lives in `src/domains/auth/verification/` as a feature within the authentication domain. Its controller, routes, service, repository, `Verification` model, feature-specific schemas/DTOs, and transformer live together. Shared request/token contracts and token generation belong to the parent auth domain. Administrative scripts import the model from its new location. Existing verification URLs, response keys, seven-day lifetime and collection name are preserved by the extraction itself; the subsequent user-unique token index is a separate schema change. Signup/email changes reuse their transaction when issuing verification, and password/account workflows invalidate it through the feature API.

Template folders now use kebab-case, for example `signUp/` becomes `sign-up/` and `resetPassword/` becomes `reset-password/`. The registry resolves existing camelCase template keys to the new paths, so persisted email jobs and service calls keep their keys. The shared partial is named `partials/action-link.ejs`. Update copied files and include paths in any custom `MAIL_TPL_PATH`; the [template catalog](../src/domains/notifications/templates/README.md) lists every folder/key mapping.

## TypeScript imports and application folders

Application code is grouped under `src/app/config/`, `database/`, `http/` (including HTTP middleware), and `runtime/`. The package entrypoints are unchanged: `src/index.ts` delegates to `app/runtime/server.ts`, and the compiled entrypoint remains `dist/index.js`.

All local TypeScript imports use `.ts`. The production compiler rewrites them through `rewriteRelativeImportExtensions`; manual rewriting of emitted files is unnecessary. Maintenance scripts also import `.ts` files. JSON imports keep their original extension. The superseded `src/routes/` layer has been removed.

`JWT_EXPIRATION` remains a duration string in environment variables and becomes a positive integer number of seconds in the parsed configuration. Zero/sub-second lifetimes and numeric overflows are rejected during configuration parsing. Application/client URLs must not contain credentials, query parameters, or fragments. After a successful initial connection, Redis retries subsequent connection losses continuously with a bounded delay instead of permanently stopping after five retries.

The import/application-folder corrections alone require no database schema or index change; apply the current model indexes separately.

## Data preparation

Stop API/worker processes and all other writers, and take a restorable database/filesystem backup before running maintenance. Maintenance scripts use the configured database and do not start HTTP or send email. Keep `MONGODB_AUTO_INDEX=false` during migration; creating unique indexes before cleaning legacy data can fail.

MongoDB must be a replica set or Atlas. The refactored API uses transactions for account mutations and media record creation.

Resolve these existing-data cases before creating indexes:

- User emails must be valid, trimmed, lowercase, and unique. Legacy provider-specific alias normalization is not reversed by the script. Resolve duplicates manually; the migration does not merge or delete accounts.
- Token records must reference a valid user and have a valid `expiresIn` date. Existing 96-character hexadecimal access tokens are migrated to hashes. Remove or repair malformed records explicitly. Unique token indexes reject duplicates/multiple records with missing token hashes.
- Ensure at most one legacy avatar per user, and at most one reset token and one verification token per account before creating the new unique token-owner indexes and attachment lookup index. Ownership can only be inferred for `Media` records with `refType: 'User'` and a valid ObjectId `refId`. The migration does not guess owners of unattached uploads.

Run the explicitly provided scripts, in order:

```sh
yarn db:migrate:legacy
yarn db:indexes
```

The legacy migration is rerunnable. It adds `authVersion` and `mutationVersion` to user documents, replaces raw `accessToken` fields with SHA-256 `tokenHash` fields, and assigns provable legacy media ownership. It logs only the number of quarantined media records. It does not normalize/merge email addresses, remove legacy user reference arrays, delete orphaned files, drop indexes, or delete documents.

This is a sequence of direct collection operations, not one all-or-nothing migration transaction. It does not validate or repair every historical record. On failure, keep writers stopped, determine which steps completed, repair the cause, and rerun or restore according to the cutover plan. Retain a protected pre-migration backup because replacing raw tokens with hashes is not reversed by reverting application code.

Index creation adds unique email/hash/user-token constraints, media attachment indexes, token TTL indexes, queue access indexes, and worker heartbeat/TTL indexes. It uses `createIndexes`, preserving operator-managed indexes. An index error stops the script with a nonzero exit code. Review existing conflicting indexes explicitly; the script does not drop them. Index TTL cleanup removes already-expired token documents after the indexes become active.

## Upload files

The previous implementation resolved upload paths from the source or generated entrypoint. With the default configuration these could have been `src/storage/public/` or `public/storage/public/`. The new default is `<project>/storage/public/`, independent of `dist/`.

Before resuming service, copy original files into the configured storage directory, preserving their random filenames. Keep the source backup until the new deployment is accepted. The database migration leaves existing path metadata in place; the image adapter reads files by `filename` within the new storage root.

Old JPEG/PNG conversion URLs are not served. WebP avatar URLs are generated from originals when the account profile is read. Legacy conversions may be archived after the transition. Unattached legacy media records without `owner` remain inaccessible for attachment; retain them for manual ownership reconciliation or explicit cleanup. Files not owned by a deleted account are never deleted speculatively.

## Client transition

- API response `message` has been replaced by `messageKey` in success and error envelopes. Translate keys on the frontend. Validation details now expose `{ path, messageKey, params? }` rather than English messages; see the [message-key contract](api-message-keys.md). Health payloads retain machine-readable statuses.
- Send the interface's chosen language through `Accept-Language` for request-triggered emails. This header no longer localizes API response text.
- Existing JWTs lack the new subject/version/issuer/audience claims and are invalidated. Users must sign in again. Old Redis blacklist keys can expire naturally.
- Password/email changes now return replacement JWTs. Store them before the next authenticated request. Email verification and password reset also return replacements and invalidate earlier account JWTs.
- The verification-request endpoint only accepts the authenticated account's current email. Use `/user/update/email` with the current password to change an email.
- Reset/verification links are single use. Requesting a new link invalidates earlier ones. Reset expiry is now one day.
- Invalid/expired bearer credentials return 401 instead of silently becoming anonymous. Guest requests should omit a stale Authorization header.
- Sign-in failures return 401. Database faults return 500 rather than the legacy catch-all 400. Payload failures include validation details.
- Uploaded image IDs can only be attached by the uploader. The API accepts one `file` multipart part and rejects extra multipart fields.
- New public images are generated WebP conversions. Original uploaded files are no longer public.
- Existing sign-out GET routes remain available; use POST for new clients.

Keep reverse-proxy logs from recording one-time tokens in verification/reset URL paths. Configure exact trusted proxy addresses for rate limiting and mount persistent storage before accepting traffic.

## Email templates and package scripts

Email localization is isolated to the notification domain. `i18next-http-middleware` and `http-status-codes` have been removed from dependencies. `i18next` remains for server-rendered email content, with a separate translator instance for every render.

Email resources now contain a shared `layout` dictionary and dictionaries by template key, each with `subject`, `title`, `body`, `text`, and optional `actionLabel`. Existing custom templates using former global translation paths must migrate to the registered template's local keys. EJS locals are `data`, `t`, `language`, `direction`, `clientUrl`, and optional `actionUrl`. Interpolation variables use `{{values.name}}`. The shared layout and existing built-in templates were updated to these locals.

`MAIL_DEFAULT_LANGUAGE` defaults to `en`; unsupported request languages fall back to this language when available, then to the template default. Register custom server-owned HTML files, variables schemas, and language dictionaries by key. The authenticated `GET /notifications/templates` endpoint lists keys and supported languages. See [notification configuration](notifications.md) for registration, replacement, plain-text alternatives, and per-message overrides.

Email delivery now uses a MongoDB transactional outbox and a separate worker. Before enabling traffic, add a persistent 64-hex-character `MAIL_QUEUE_ENCRYPTION_KEY` to API/worker configuration, configure `MAIL_MESSAGE_ID_DOMAIN`, and create the new `email_outbox` collection/indexes with `yarn db:indexes`. No existing account/token documents need a data migration for this feature. Run `yarn dev:mail` in development or deploy `yarn start:mail` alongside the compiled API.

Account notifications enqueue inside their owning MongoDB transaction and require its session. Enqueue errors now roll back the account mutation, rather than being swallowed after commit. SMTP errors are handled asynchronously by the worker. Generic sending uses `enqueueTemplate` and returns a receipt; code relying on immediate SMTP completion must migrate to delivery-status tracking. See [worker deployment and delivery guarantees](notifications.md) for retries, expiry, idempotency, encryption-key lifetime, and recovery.

### Server-side service API cleanup

Update custom server code using the former notification helpers:

| Former call                                        | Current call                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notificationService.sendTemplate(input, context)` | `notificationService.enqueueTemplate(input, context)`                                                                                                         |
| `notificationService.signUp(options, session)`     | `notificationService.enqueueAccount('signUp', options, session)`                                                                                              |
| Other one-template account methods                 | `notificationService.enqueueAccount('<same-template-key>', options, session)`                                                                                 |
| `notificationService.listTemplates()`              | Import `listEmailTemplates` from the public notification index; it returns an array, so use `{ templates: listEmailTemplates() }` where an envelope is needed |

User persistence methods return domain DTOs through the public service facade; custom code must not depend on Mongoose query chaining across that boundary. Local profile serialization calls its transformer directly rather than `userService.me`. Token/owner locks, account transactions, HTTP routes/response shapes, database schemas/indexes, and persisted template keys are unchanged by this cleanup.

### HTTP adapter cleanup

Custom controllers must use the new helper argument order: replace `respond(res, data, status, messageKey)` with `respond(res, messageKey, data, status)`. Omit the final argument for the default `200`; no-data success becomes `respond(res, messageKey)`. Success keys are explicit. `createErrorResponse(status, messageKey?, details?)` retains its existing signature/default-key behavior.

The template-catalog handler now lives directly in its domain router, and the final 404 fallback is inline in application composition. There are no notification-controller or standalone not-found-middleware modules to import. Existing endpoint paths, guards, response envelopes/keys, limiter ordering, and static-versus-API cache policy are retained.

### Route and Swagger cleanup

Existing application methods/paths, handler order, guards, and limiters are retained. Sign-out's POST/legacy GET share one Express route path; auth now composes verification documentation, so remove a separate verification spread from custom root specification assembly.

Update custom `operation()` definitions: replace `authenticated: true` / `guestOnly: true` with required `access: 'authenticated'` / `access: 'guest'`; use `access: 'public'` for optional-auth application handlers. Replace `token: true` with `params: tokenParamsSchema` from the actual route contract. Replace `language: true` with `emailLanguage: true`; this now documents the header only, so keep transaction/delivery claims in the operation description. Apply `deprecated: true` to a resulting operation/variant rather than helper input.

Use `body` for the current flat JSON/form request schemas, or an explicit native `requestBody` for multipart/custom media types; these alternatives are mutually exclusive. Responses use Zod output mode, including closed object shapes and exact health status values. Generated clients may therefore change types even though endpoint payloads are retained. Error metadata now distinguishes parser `413`/`415`, image `400`, applicable policy/token `403`, and operation-specific `404`/`409`. See [OpenAPI maintenance](openapi.md#maintaining-the-reference).

### Schema and DTO cleanup

Update custom imports to the canonical contracts; operation-specific aliases for identical shapes have been removed:

| Former schema / DTO                                                                                                 | Current schema / DTO                                                   |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Auth `signInSchema`, `updateEmailSchema` / `SignInDto`, `UpdateEmailDto`                                            | Auth `credentialsSchema` / `CredentialsDto`                            |
| Auth `resetPasswordSchema`, verification `verificationRequestSchema` / `ResetPasswordDto`, `VerificationRequestDto` | Auth `emailRequestSchema` / `EmailRequestDto`                          |
| Verification `verificationTokenParamsSchema` / `VerificationTokenParamsDto`                                         | Auth `tokenParamsSchema` / `TokenParamsDto`                            |
| Users `updateProfileResponseSchema` / `UpdateProfileResponseDto`                                                    | Users `updateProfileSchema` / `UpdateProfileDto`                       |
| Media `UploadImageDto`                                                                                              | Media `StoredImageDto`; the local Multer adapter is `toStoredImageDto` |

Unused environment DTOs, `NotificationTemplateDto`, `NotificationOptionsDto`, `NotificationDto`, `DeliveryStatusDto`, and the standalone `ResponseMetadataDto` alias are removed. Use `SendTemplateDto` for custom enqueue input or `AccountNotificationDto` for account operations, including the required template/owner metadata for the chosen operation. Internal prepared/encrypted payloads use `PreparedNotificationDto`; a delivery's status type is available as `DeliveryDto['status']`. Environment values are inferred by `loadEnvironment`; HTTP metadata is included directly in `ApiResponseDto`.

Defaults/transforms belong to the schema. Pre-parse options use `z.input`; parsed contracts use `z.infer` / `z.output`. Existing HTTP request constraints, response shapes, routes, and message keys are retained by this cleanup. Internal email-token contracts share the existing 96-hex-character format, and SMTP failure types are restricted to SMTP error codes. Native persistence/framework types are retained, and no database/index migration is required. See [schema ownership](architecture.md#schema-and-dto-ownership).

### Utility module cleanup

Custom code inside an owning domain should use the current module locations:

| Former internal location/helper                        | Current owner                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `app/runtime/utils.ts`                                 | `app/runtime/paths.ts` for `projectRoot` and shared `resolveWithinRoot`                |
| `media/utils.ts` image class / configurable resize     | `media/image.ts`; `Image.resize()` creates the single supported avatar conversion      |
| `notifications/utils.ts` preparation                   | `notifications/preparation.ts`                                                         |
| `notifications/utils.ts` rendering/file initialization | `notifications/renderer.ts`; public facade/index entrypoints remain available          |
| `notifications/delivery/utils.ts` SMTP classification  | `notifications/mailer.ts`                                                              |
| Exported queue retry / delivery-ID helpers             | Private worker retry policy and enqueue-time ID generation                             |
| `createCryptoString` plus a separate expiry helper     | `auth/utils.ts` `createEmailToken(lifetimeDays)` returns `{ accessToken, expiresIn }`  |
| `createVerificationToken` wrapper                      | Verification-service DTO assembly using the shared email-token factory                 |
| Password hash / compare wrappers                       | `hashPassword` keeps configured rounds; service code imports bcrypt `compare` directly |

Cross-domain code must continue using public indexes/contracts rather than importing these internals. Existing token entropy/lifetimes/hash format, queue ciphertext/idempotency format, template keys/paths, avatar filenames, and HTTP contracts are retained. No data/index migration is introduced by this source cleanup.

Package metadata now describes the domain-based API and includes repository, homepage, and issue links. Canonical scripts are `dev`, `lint:fix`, `format`, and `format:check`; update automation using the removed aliases:

| Former command        | Current command     |
| --------------------- | ------------------- |
| `yarn watch`          | `yarn dev`          |
| `yarn lint:write`     | `yarn lint:fix`     |
| `yarn prettier:write` | `yarn format`       |
| `yarn prettier`       | `yarn format:check` |

`build`, `start`, `lint`, `db:migrate:legacy`, and `db:indexes` retain their names. `dev:mail` and `start:mail` are the new worker entrypoints; the existing build emits both API and worker code.

## Configuration, documentation, and operational changes

Runtime entrypoints now use a shared bootstrap that aggregates required configuration profiles before service clients load. Start the API through `src/index.ts` / `dist/index.js` and the worker through `app/runtime/mail/worker`; importing `server.ts` or `mail/process.ts` directly bypasses that preparation. Compiled operator command paths and existing exit codes remain available.

Development logs are readable text; production logs remain JSON. Errors/warnings now use stderr, so collectors must ingest both stdout and stderr. Optional `API_LOG_FILENAME` stays JSON in both modes. Queue/OpenAPI stdout results remain JSON, with bootstrap/configuration/argument failures on stderr. Update log consumers that assumed development JSON or stdout-only errors, and use diagnostic codes rather than matching raw driver text. No environment keys or HTTP response envelopes change. See [runtime diagnostics](logging.md).

Configuration is split into runtime, MongoDB, API, notification, queue, delivery, and SMTP profiles. Worker processes no longer require JWT or Redis settings; queue diagnostics and database maintenance need only MongoDB-related settings. Secret-bearing values can be supplied through supported `*_FILE` variables. See [configuration](configuration.md) for exact ownership and precedence.

Ordinary API/worker startup does not run schema-maintenance scripts; automatic model DDL remains disabled by default. Reset/verification issuance now updates a user-keyed token record in place. Stop writers and reconcile duplicate token owners/attached avatar owners before running the additive index command. It preflights conflicts but neither chooses winning records nor drops existing indexes. See [database](database.md) for the current index map and obsolete-index review candidates.

Swagger UI at `/docs/` and the JSON specification at `/openapi.json` are opt-in (`DOCS_ENABLED`). Enabled production docs require dedicated username/password credentials. `DOCS_TRY_IT_OUT_ENABLED` independently enables manual execution; its default is false. `docs:export` produces the spec without starting services or requiring secrets. Domain route metadata and DTO schemas describe the current API.

`mail:queue` adds operator commands for safe metadata, cursor-paginated lists, stats, explicit retry, heartbeat workers, and worker health. Every operational tool also has a compiled `:prod` entrypoint. The source implementations live in `app/runtime/commands`; existing `scripts/` paths are thin development entrypoints.

The production image/Compose examples run API and mail workers separately and mount role-specific secrets. The worker heartbeat adds the `email_workers` collection; run index maintenance before enabling new workers. Copy role environment examples and provision real credentials through your deployment process. See [operations](operations.md), [OpenAPI](openapi.md), [deployment](deployment.md), and [CHANGELOG](../CHANGELOG.md).

## Validation status

See the dated [validation status](../README.md#validation-status). Local tooling has passed; database migration/index execution and runtime acceptance remain unvalidated. Record environment-specific results in the [handoff](handoff.md#record-results).
