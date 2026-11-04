# Express + MongoDB REST API boilerplate

A TypeScript starter for applications that need account authentication, email verification, password recovery, image uploads, and background email delivery. Built with Express 5, TypeScript 7, MongoDB, Redis, and Zod, with domain-owned modules and an OpenAPI 3.1 reference.

**Version 2.0.0.** Upgrading an existing installation? Start with the [1.x → 2.0 migration guide](docs/migration.md).

[Quick start](#quick-start) · [API examples](#api-examples) · [Developer guide](docs/development.md) · [Troubleshooting](#troubleshooting) · [Documentation index](docs/README.md)

## What is included

- **Account workflows:** JWT authentication, revocation, profile management, verification, and password recovery.
- **Domain-based code:** local schemas, inferred DTOs, services, repositories, transformers, and utilities.
- **Background email:** encrypted MongoDB outbox, a separate worker, retries, leases, and operator commands.
- **Customizable templates:** server-owned HTML/plain-text templates, English/Georgian content, and language selection through `Accept-Language`.
- **Owned image uploads:** JPEG/PNG ingestion, WebP avatars, and ownership checks.
- **Developer and deployment tooling:** Swagger UI, TypeScript/ESLint/Prettier commands, and separate API/worker container definitions.

## Quick start

### 1. Prepare the dependencies

Install or provision these services before starting the application:

| Dependency | Requirement                                                                       |
| ---------- | --------------------------------------------------------------------------------- |
| Node.js    | **26.13.0**, pinned in [.nvmrc](.nvmrc); engine range `>=26.13.0 <27`             |
| Yarn       | **4.18.1**, pinned in [package.json](package.json) and [.yarnrc.yml](.yarnrc.yml) |
| MongoDB    | **8.x replica set** or an Atlas deployment supporting transactions                |
| Redis      | Reachable from the API for shared rate limits and JWT revocation                  |
| SMTP       | Reachable from the mail worker; a local development relay can use port `1025`     |

Account changes and email jobs commit in one transaction, so standalone MongoDB is insufficient. The application does not start MongoDB, Redis, or an SMTP relay for you.

### 2. Install and configure

From the repository root:

```sh
nvm install
nvm use
node .yarn/releases/yarn-4.18.1.cjs --version
node .yarn/releases/yarn-4.18.1.cjs install --immutable
cp .env.example .env
```

Examples below use `yarn`. An existing Yarn/Corepack launcher selects the committed release through `yarnPath`; without a launcher, replace `yarn` with `node .yarn/releases/yarn-4.18.1.cjs`. Ordinary `node_modules` loading is retained. See [tooling](docs/tooling.md) for CI, lifecycle scripts, production dependencies, and the TypeScript compatibility note.

Edit `.env`. The [example configuration](.env.example) contains local defaults; configure these values for your environment:

| Setting                     | Local value or requirement                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `MONGODB_URI`               | `mongodb://127.0.0.1:27017/express_api?replicaSet=rs0`; match your actual replica-set name |
| `REDIS_URI`                 | `redis://127.0.0.1:6379`                                                                   |
| `APP_URL` / `APP_PORT`      | `http://localhost:8000` / `8000`                                                           |
| `CLIENT_URL`                | `http://localhost:3000`; used for frontend links and the allowed CORS origin               |
| `JWT_SECRET`                | An independently generated random secret of at least 32 characters                         |
| `MAIL_QUEUE_ENCRYPTION_KEY` | A persistent 64-character hexadecimal key shared by the API and worker                     |
| `MAIL_HOST` / `MAIL_PORT`   | Your SMTP relay; the example uses `127.0.0.1:1025`                                         |
| `MAIL_FROM`                 | A sender address accepted by your relay/provider                                           |

Run the following command separately for each secret, then assign the outputs to `JWT_SECRET` and `MAIL_QUEUE_ENCRYPTION_KEY` in `.env`:

```sh
openssl rand -hex 32
```

Keep `.env` private and preserve the queue key across restarts and deployments. Existing encrypted jobs depend on it. SMTP authentication/TLS, secret files, custom URLs, and process-specific settings are covered in [configuration](docs/configuration.md).

### 3. Initialize a new database and start the API

For a **new, empty database**, provision collections and indexes before accepting traffic:

```sh
yarn db:indexes
yarn dev
```

For existing data, follow the [migration guide](docs/migration.md) first. Index maintenance is an explicit database operation; installation and normal startup do not run it.

### 4. Start email delivery

In another terminal, from the same repository root:

```sh
yarn dev:mail
```

The API persists email jobs; the worker renders and submits them through SMTP. Start both processes for complete account-email workflows.

With the local example settings, the expected addresses after startup are:

| Resource     | Address                                                                  | Expected behavior                                            |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| API base     | `http://localhost:8000`                                                  | Use a documented endpoint, such as `/auth/sign-in`           |
| Swagger UI   | [http://localhost:8000/docs/](http://localhost:8000/docs/)               | Available with `DOCS_ENABLED=true`, as set in `.env.example` |
| OpenAPI JSON | [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json) | Available when documentation is enabled                      |
| Liveness     | [http://localhost:8000/health/live](http://localhost:8000/health/live)   | HTTP `200`, `{"status":"ok"}`                                |
| Readiness    | [http://localhost:8000/health/ready](http://localhost:8000/health/ready) | HTTP `200` with `ready`, or `503` with `unavailable`         |

API readiness reports MongoDB/Redis state. Worker health and SMTP delivery are monitored separately.

## API examples

These examples use the local configuration and illustrative responses. Replace the account credentials and returned tokens with your own. IDs, timestamps, and JWTs vary between requests.

### Register an account

```sh
API_BASE_URL=http://localhost:8000

curl -i "$API_BASE_URL/auth/sign-up" \
  -H 'Content-Type: application/json' \
  -H 'Accept-Language: ka-GE, ka;q=0.9, en;q=0.7' \
  --data '{"email":"developer@example.com","password":"ExamplePassword123!"}'
```

Successful response, HTTP `200`:

```json
{
  "data": { "accessToken": "<JWT>" },
  "messageKey": "auth.signed_up",
  "status": 200
}
```

Registration queues welcome and verification emails in the account transaction. Success confirms persistence; delivery proceeds asynchronously. `Accept-Language` selects email content, while the client translates the API's `messageKey`.

### Sign in and call an authenticated endpoint

```sh
curl -i "$API_BASE_URL/auth/sign-in" \
  -H 'Content-Type: application/json' \
  --data '{"email":"developer@example.com","password":"ExamplePassword123!"}'
```

The response has the same token envelope with `messageKey: "auth.signed_in"`. Copy `data.accessToken` from registration or sign-in:

```sh
ACCESS_TOKEN='<paste data.accessToken here>'

curl -i "$API_BASE_URL/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Example profile response, HTTP `200`:

```json
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "developer@example.com",
    "verified": false,
    "createdAt": "2026-11-01T12:00:00.000Z",
    "updatedAt": "2026-11-01T12:00:00.000Z"
  },
  "messageKey": "users.profile_loaded",
  "status": 200
}
```

Profile names and an avatar URL appear when available. Password/email changes and email confirmation invalidate previous account JWTs; save the replacement token returned by those operations. Guest endpoints, including registration and sign-in, should omit `Authorization`.

### Handle validation errors

A password shorter than six characters is rejected:

```sh
curl -i "$API_BASE_URL/auth/sign-up" \
  -H 'Content-Type: application/json' \
  --data '{"email":"developer@example.com","password":"short"}'
```

Response, HTTP `400`:

```json
{
  "messageKey": "validation.failed",
  "status": 400,
  "details": [
    {
      "path": "password",
      "messageKey": "validation.too_small",
      "params": { "min": 6, "inclusive": true, "origin": "string" }
    }
  ]
}
```

Translate each key on the client and use `path` to associate field errors. Success envelopes contain optional `data`; errors contain optional `details`. HTTP status codes and machine keys describe outcomes. Responses include a server-generated `X-Request-Id` for correlation. See [client integration](docs/client-integration.md) for the full route map and JWT/link/upload workflows, and the [message-key contract](docs/api-message-keys.md) for translations.

## API reference and Swagger

Swagger covers authentication, verification, account management, media, template metadata, and health endpoints. It includes request/response schemas, authentication requirements, status codes, and workflow notes. Use the [OpenAPI guide](docs/openapi.md) for the complete reference and export options.

The reference distinguishes required/optional bearer access from guest-only routes, derives path parameters from their schemas, and uses Zod input contracts for requests and output contracts for responses. JSON/form bodies, multipart failures, rate-limit headers, and raw health responses follow the HTTP implementation. Documentation metadata does not register routes or middleware.

Documentation is opt-in. `DOCS_ENABLED=true` enables `/docs/`, `/docs/openapi.json`, and `/openapi.json`. Interactive submission has its own setting, `DOCS_TRY_IT_OUT_ENABLED`, which defaults to `false`. Production documentation requires dedicated credentials and HTTPS; documentation credentials are separate from account JWTs.

Export a specification without starting services or providing database/JWT/SMTP credentials:

```sh
yarn docs:export --output openapi.json
```

The exporter refuses to overwrite an existing file. Choose a new output path for subsequent exports. Swagger assets are served locally, and external schema validation is disabled.

## Project structure

```text
src/
  index.ts
  app/
    config/                 Validated configuration by process role
    database/               MongoDB transactions and API Redis connection
    http/                   Express composition, middleware, contracts, Swagger
    runtime/                API/worker lifecycles, logging, operator commands
  domains/
    auth/
      verification/         Email ownership confirmation
    users/                  Account/profile persistence
    media/                  Owned images and avatars; image.ts owns processing
    notifications/
      preparation.ts        Template-variable validation and locale selection
      renderer.ts           HTML/text rendering and template initialization
      mailer.ts             SMTP submission and failure classification
      delivery/             Outbox, leases, retries, worker, administration
      templates/            HTML/text templates, layout, partials
      translations/         Email dictionaries
scripts/                    Development entrypoints and build orchestration
ops/                        Containers, role environments, secret-file guidance
docs/                       Architecture, API, migration, operating guides
```

Each feature keeps its controllers, services, repositories, models, `schemas.ts`, `dto.ts`, `transformer.ts`, and local `utils.ts` together as needed. Domains expose an explicit `index.ts` API and public DTO/schema contracts. Verification remains inside `auth`; delivery remains inside `notifications`.

Schemas are the source of truth for data contracts: infer parsed DTOs with `z.infer` and pre-parse inputs with `z.input`. Reuse identical contracts and derive meaningful variants; do not create operation-specific aliases for the same shape. Native database/framework adapters keep their library types. See [schema and DTO ownership](docs/architecture.md#schema-and-dto-ownership).

`transformer.ts` is optional: use it for ID/date conversion, normalization, or a meaningful public-field boundary. Assemble simple response objects where they are produced. DTOs describe types; they do not transform or filter runtime values. See the [decision rules](docs/architecture.md#when-a-transformer-is-useful).

Services add business rules and orchestration. Repository operations that already return the domain contract can be exposed through direct function references in the public facade, without another forwarding function. See [service/repository boundaries](docs/architecture.md#services-and-repositories).

Small HTTP handlers can live directly in a domain router; create a controller when input/context adaptation warrants it. See [controllers and middleware](docs/architecture.md#controllers-and-middleware) for response helpers, guards, and composition rules.

Keep `utils.ts` focused on small local helpers. Image processing, notification preparation/rendering, and SMTP behavior have named modules within their owning domains; the [utility ownership map](docs/architecture.md#utilities-and-ownership) documents their boundaries.

Relative source imports use `.ts`; TypeScript rewrites them to `.js` in `dist/`. The build compiler is TypeScript **7.0.2** under `@typescript/native`; `typescript` pins the complete **6.0.3** JavaScript SDK required by ESLint tooling. Using the SDK directly avoids Yarn patching a compatibility re-export package and fixes YN0066. See [tooling](docs/tooling.md#typescript-compatibility-note) and [architecture](docs/architecture.md).

## Commands

For new domains and endpoints, follow the [developer guide](docs/development.md): schemas → DTOs → persistence → service → middleware/controller → routes → Swagger, including registration points and extension rules. Use the [QA and release handoff guide](docs/handoff.md) to transfer the feature with explicit acceptance expectations and evidence.

| Command                                                  | Purpose                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| `yarn dev` / `yarn dev:mail`                             | Watch API / mail-worker source                                 |
| `yarn check`                                             | Run formatting, lint, type-safe build, tests and 100% coverage |
| `yarn test`                                              | Build and run colocated unit tests without external services   |
| `yarn test:coverage`                                     | Enforce 100% Istanbul coverage for all application modules     |
| `yarn test:coverage:report`                              | Generate coverage diagnostics without enforcing the threshold  |
| `yarn typecheck`                                         | Check source types with TypeScript 7, without emitting files   |
| `yarn build`                                             | Compile API, worker, and operator commands; copy templates     |
| `yarn start` / `yarn start:mail`                         | Run the compiled API / worker                                  |
| `yarn lint` / `yarn lint:fix`                            | Run ESLint / apply fixes                                       |
| `yarn format` / `yarn format:check`                      | Write Prettier formatting / check formatting                   |
| `yarn docs:export` / `yarn docs:export:prod`             | Export OpenAPI from source / compiled code                     |
| `yarn mail:queue` / `yarn mail:queue:prod`               | Inspect queue metadata or explicitly retry an eligible job     |
| `yarn db:indexes` / `yarn db:indexes:prod`               | Preflight conflicts and create missing collections/indexes     |
| `yarn db:migrate:legacy` / `yarn db:migrate:legacy:prod` | Run the explicit legacy-data migration                         |

Run `yarn build` before compiled commands. Build output is in `dist/`; uploads remain in the configured persistent storage directory. Queue retry, index creation, and legacy migration change state; select the intended environment before invoking them.

## Troubleshooting

| Symptom                                                        | What to inspect and how to resolve it                                                                                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup reports `CONFIG_INVALID`                               | Correct all listed settings for this process in `.env` or its environment. Each issue includes an explanation; do not configure both a nonempty secret and its `_FILE` counterpart. See [runtime diagnostics](docs/logging.md). |
| MongoDB connection fails or account transactions are rejected  | Check reachability, credentials, replica-set discovery/name, and transaction support. Use a replica set or Atlas; create collections/indexes before writes. See [database](docs/database.md).                                   |
| Startup fails at `redis`, or readiness returns `503`           | Restore MongoDB/Redis connectivity and check URI/TLS settings. Redis also backs rate limits and revocation; API readiness does not describe SMTP health.                                                                        |
| Swagger returns `404` or requests documentation credentials    | Set `DOCS_ENABLED=true` and restart the API. If docs credentials are configured, use their dedicated HTTP Basic login; production requires them. See [OpenAPI](docs/openapi.md).                                                |
| Authentication returns `401`, or sign-in/sign-up returns `403` | Use a current bearer JWT for authenticated routes. Save replacement tokens after security changes, and omit `Authorization` on guest routes.                                                                                    |
| Requests return `429` during repeated manual calls             | Respect `Retry-After` and the configured rate-limit window. Check the separate sensitive-route limit and trusted-proxy settings before adjusting development limits.                                                            |
| Emails remain queued                                           | Run `yarn mail:queue stats` and `yarn mail:queue workers`. Start/restore the separate worker and inspect its logs, job deadlines, and SMTP availability.                                                                        |
| Jobs fail with `payload.invalid`                               | Restore the original queue key shared by the API and worker. Changing the key does not re-encrypt existing jobs. Follow the [queue recovery guide](docs/operations.md).                                                         |
| Jobs fail with `render.failed` or `smtp.configuration`         | Inspect template registration/files or the worker's SMTP credentials/TLS settings. Repair the cause before explicitly retrying an unexpired failed job. See [notifications](docs/notifications.md).                             |
| A job is `sent`, but the recipient has no email                | `sent` records SMTP acceptance. Check the provider's delivery/bounce records and recipient filtering; worker health cannot establish inbox delivery.                                                                            |

Queue diagnostics expose safe metadata. `yarn mail:queue --help` lists commands and `yarn mail:queue list --status failed --limit 25` lists failed jobs. Read [operations](docs/operations.md) before retrying work; uncertain SMTP acceptance can already have delivered a message.

Startup/runtime failures have stable codes, readable reasons, and actions. Bootstrap reports all invalid settings for the selected process before loading service clients. Development uses readable console output; production and optional file logs use sanitized JSON. Errors/warnings go to stderr, and ordinary runtime records go to stdout. HTTP logs use route patterns and request IDs. See [runtime diagnostics](docs/logging.md) for examples, categories, and troubleshooting.

## Deployment and operating limits

The [deployment guide](docs/deployment.md) describes the multi-stage Docker image, separate API/worker processes, role-specific environments/secrets, persistent uploads, and rollout/backup responsibilities. MongoDB, Redis, and SMTP are provisioned separately. Keep automatic model DDL disabled in production and apply indexes explicitly after data preparation.

Email delivery has bounded retries and expiry. A crash after SMTP acceptance can cause duplicate delivery attempts; stable Message-IDs do not guarantee inbox deduplication. Account changes and job creation are transactional, while SMTP submission happens afterward. See [notifications](docs/notifications.md) for retention, cancellation, and key lifetime.

Uploads use ownership checks and private originals; only generated WebP conversions are public. Filesystem cleanup after account deletion is best effort. Persistent storage and matching backups are required. See [architecture](docs/architecture.md) and [database](docs/database.md) for consistency boundaries.

Configure HTTPS, trusted proxies, sender identity, secret management, and external log/health monitoring for the target environment. Reverse-proxy access logs need their own redaction for token-bearing URLs.

## Documentation

The [tooling guide](docs/tooling.md) covers the pinned Yarn release, immutable installs, CI/container commands, and TypeScript compatibility.

The [documentation index](docs/README.md) provides reading paths for developers, frontend clients, QA, and operators.

| Guide                                                             | Contents                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [OpenAPI and Swagger](docs/openapi.md)                            | Endpoint schemas, documentation access, export                               |
| [Client integration](docs/client-integration.md)                  | Route/payload map, JWT lifecycle, email links, browser requests, uploads     |
| [Architecture](docs/architecture.md)                              | Domain ownership, dependency and transaction boundaries                      |
| [Developer guide](docs/development.md)                            | Add domains, schemas, services, transformers, middleware, routes, Swagger    |
| [QA and release handoff](docs/handoff.md)                         | Feature handoff, manual scenarios, evidence, release ownership               |
| [Configuration](docs/configuration.md)                            | Settings, process roles, secret files                                        |
| [Database](docs/database.md)                                      | Models, indexes, constraints, maintenance                                    |
| [Notifications](docs/notifications.md)                            | Templates, locales, rendering, delivery guarantees                           |
| [Template catalog](src/domains/notifications/templates/README.md) | Folder/key mapping and editable template files                               |
| [Operations](docs/operations.md)                                  | Queue CLI, monitoring, recovery, shutdown                                    |
| [Runtime diagnostics](docs/logging.md)                            | Readable console errors, bootstrap validation, safe logs, failure categories |
| [Deployment](docs/deployment.md)                                  | Containers, production configuration, rollout, backups                       |
| [API message keys](docs/api-message-keys.md)                      | Client translation and validation contracts                                  |
| [Migration](docs/migration.md)                                    | Upgrade from 1.x to 2.0                                                      |
| [Changelog](CHANGELOG.md)                                         | Version 2.0 changes                                                          |

## Validation status

Local results under Node.js **26.13.0**. Tooling and dependency-install results below were recorded **2026-11-01**; unit and runtime checks were added **2026-11-04**:

| Area                                                                                                              | Status                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| TypeScript 7 typecheck and build                                                                                  | Passed                                                                                                           |
| ESLint and Prettier                                                                                               | Passed                                                                                                           |
| Yarn 4 immutable install / production dependency focus                                                            | Passed with lifecycle/build execution disabled; production tools pruned and lockfile unchanged                   |
| Unit tests (2026-11-04)                                                                                           | 375 passed; colocated `__tests__` folders, no external services                                                  |
| Compiled OpenAPI export                                                                                           | Generated; 18 operations / 17 paths match explicit source registrations                                          |
| Local API/worker and account workflows (2026-11-04)                                                               | 53 HTTP/SMTP checks passed with MongoDB 8 replica set, isolated Redis, and Mailpit; new database indexes created |
| Production deployment, generated clients, legacy migrations, application containers, external SMTP/inbox delivery | Not validated                                                                                                    |

Unit tests live beside the owning modules in `__tests__/*.test.mjs`; shared fixtures are in `src/__tests__`. Run `yarn test` after changes. The runner builds TypeScript first and tests the emitted JavaScript, including copied email templates. Node module mocks isolate MongoDB, Redis, and SMTP; temporary image files are removed after tests. The module-mocking API requires the experimental flag supplied by the scripts.

`yarn test:coverage` enforces 100% statements, branches, functions, and lines across every compiled application module, including unloaded modules. Instrumentation runs only in tests; reports are written to `coverage/index.html` and `coverage/coverage-summary.json`. See [testing](docs/testing.md) for scope and runtime evidence. Target-environment acceptance remains part of deployment.

## License

[MIT](LICENSE) · Vacho Aivazov.
