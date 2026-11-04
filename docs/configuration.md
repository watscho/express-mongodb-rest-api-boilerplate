# Configuration and process roles

Configuration is validated when its owning module is imported. `schemas.ts` defines reusable settings; narrow modules select only fields needed by their process. There is no eagerly validated universal environment object.

API/worker bootstrap imports every required configuration profile before service clients, aggregates configuration failures, and reuses successful modules through ESM caching. Operator entrypoints preserve their narrower roles and credential-free help. See [runtime diagnostics](logging.md) for readable errors and stream/format behavior.

`loadEnvironment` infers each parsed profile as `Readonly<z.output<Schema>>`; separate environment DTO aliases are unnecessary. Boolean settings share the same strict `true`/`false` parser and default to `false`. Reuse validators only when constraints/defaults match; configuration coercion is distinct from already parsed domain values. The remaining configuration DTO adapts Mongoose's native connection options.

| Module             | Owner                                          | Required secrets                                                                   |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `runtime.ts`       | Logging and runtime mode                       | None                                                                               |
| `database.ts`      | MongoDB connection/pools                       | MongoDB URI                                                                        |
| `api.ts`           | HTTP, Redis, JWT, uploads, documentation       | Redis URI, JWT secret; docs credentials only when configured/enabled in production |
| `notifications.ts` | Client links, language defaults, template root | None                                                                               |
| `queue.ts`         | Producer/consumer payload encryption           | Queue encryption key                                                               |
| `delivery.ts`      | Retry/lease/retention/heartbeat limits         | None                                                                               |
| `media.ts`         | Upload quotas, retention and storage paths     | None                                                                               |
| `mail.ts`          | SMTP submission and Message-ID domain          | SMTP credentials when required by the provider                                     |

The API imports runtime, MongoDB, API, notification, queue, delivery, and media settings. The mail worker imports runtime, MongoDB, notification, queue, delivery, and SMTP settings. It has no dependency on the API/JWT/Redis profile. Queue administration imports only MongoDB and delivery settings; OpenAPI export imports no environment configuration.

`dotenv/config` supports a local root `.env`; Node's `--env-file` or `DOTENV_CONFIG_PATH` can select another development file. Container environments use the separate examples in `ops/environments/`. Do not copy secrets or `.env` into an image.

Run local commands from the repository root so dotenv finds the intended `.env`, or provide `DOTENV_CONFIG_PATH` explicitly. With default dotenv behavior, an already supplied process environment value takes precedence over a value in `.env`. Each profile is parsed once when imported; editing a file does not reconfigure running clients.

| Process                  | Service connections / resources                                                     |
| ------------------------ | ----------------------------------------------------------------------------------- |
| API                      | MongoDB, Redis, JWT signing, queue encryption, writable upload storage              |
| Mail worker              | MongoDB, queue encryption, template files/dictionaries, SMTP                        |
| Media cleanup            | MongoDB and writable upload storage; no JWT/Redis/SMTP/queue key                    |
| Queue CLI                | MongoDB and operational delivery settings; no decryption/JWT/Redis/SMTP credentials |
| Index/legacy maintenance | MongoDB and logging; maintenance privileges as needed                               |
| OpenAPI export           | Package metadata and pure schemas; no environment profile or service connection     |

## Secret files

These plain settings also accept a `_FILE` path:

- `MONGODB_URI`
- `REDIS_URI`
- `JWT_SECRET`
- `DOCS_PASSWORD`
- `MAIL_QUEUE_ENCRYPTION_KEY`
- `MAIL_USER`
- `MAIL_PASSWORD`

For example, `JWT_SECRET_FILE=/run/secrets/jwt_secret` reads the secret at startup. Nonempty plain and file values together are rejected. Missing/unreadable/empty files stop startup with the setting name only. Trailing whitespace is stripped from secret files. Configuration errors contain field paths and issue codes rather than rejected values, raw filesystem paths, or secret-bearing error messages.

Changing files does not reload a running process. Restart affected services. Queue encryption-key rotation needs a drain/migration strategy; retain the key while pending/retained encrypted jobs or idempotency fingerprints depend on it.

## HTTP and authentication

| Setting                                  | Default                                          | Notes                                                     |
| ---------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| `NODE_ENV`                               | `development`                                    | `development` or `production`                             |
| `APP_HOST` / `APP_PORT`                  | `0.0.0.0` / `8000`                               | HTTP listener                                             |
| `APP_URL`                                | `http://localhost:8000`                          | Public API base for image URLs and docs server path       |
| `CLIENT_URL`                             | `http://localhost:3000`                          | Frontend base for email actions and CORS origin           |
| `REDIS_URI`                              | Required                                         | `redis:` or `rediss:` URL                                 |
| `JWT_SECRET`                             | Required                                         | At least 32 characters; persistent/random                 |
| `JWT_EXPIRATION`                         | `24h`                                            | Positive duration converted to whole safe-integer seconds |
| `JWT_ISSUER` / `JWT_AUDIENCE`            | `express-mongodb-api` / `express-mongodb-client` | Verified when reading JWTs                                |
| `BCRYPT_ROUNDS`                          | `12`                                             | Range 10–16                                               |
| `TRUST_PROXY`                            | Empty                                            | Exact proxy addresses/CIDRs; avoid unconditional trust    |
| `SHUTDOWN_TIMEOUT_MS`                    | `10000`                                          | API drain deadline                                        |
| `MAX_UPLOAD_BYTES`                       | `10485760`                                       | Multipart image byte limit                                |
| `STORAGE_PATH` / `STORAGE_URL`           | `storage/public` / `/storage/public`             | Persistent filesystem path / public path prefix           |
| `RATE_LIMIT_WINDOW_MS`                   | `900000`                                         | Shared Redis limiter window                               |
| `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | `100` / `10`                                     | API / sensitive-route limits                              |

HTTP(S) application URLs may include a base path but cannot contain credentials, query strings, or fragments. Reverse proxies must preserve or deliberately rewrite these paths consistently. JWT lifetimes shorter than one whole second, zero, and overflows are rejected.

`APP_HOST`/`APP_PORT` control the listener; changing `APP_URL` does not move it or mount Express routes under a prefix. For example, with public `APP_URL=https://api.example.com/api`, the proxy must map external `/api/me` to application `/me`, and do the same for docs, health, and storage paths. Public image URLs and the live OpenAPI server path include the configured base. Avoid adding the same prefix twice in `STORAGE_URL`. See [deployment](deployment.md#proxy-docs-and-logging).

## MongoDB

| Setting                                           | Default                        |
| ------------------------------------------------- | ------------------------------ |
| `MONGODB_URI`                                     | Required replica-set/Atlas URI |
| `MONGODB_AUTO_INDEX`                              | `false`                        |
| `MONGODB_MAX_POOL_SIZE` / `MONGODB_MIN_POOL_SIZE` | `20` / `0`                     |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS`             | `10000`                        |
| `MONGODB_CONNECT_TIMEOUT_MS`                      | `10000`                        |
| `MONGODB_WAIT_QUEUE_TIMEOUT_MS`                   | `10000`                        |
| `MONGODB_MAX_IDLE_TIME_MS`                        | `60000`                        |

The minimum pool cannot exceed the maximum. Pool budgets apply per process and replica; include health/maintenance clients when sizing server connections. Writes request majority acknowledgement, and transactions use primary/snapshot reads. Disabling automatic indexing also disables Mongoose's automatic collection creation; provision collections/indexes explicitly before writes. Operational commands force automatic model DDL off even if a development environment enables it.

## Documentation

`DOCS_ENABLED` and `DOCS_TRY_IT_OUT_ENABLED` default to `false`. `.env.example` explicitly enables docs for local development. Production docs require `DOCS_USERNAME` and a dedicated password of at least 32 characters through `DOCS_PASSWORD` or its file counterpart. Username/password must be supplied together. Use a username without colons or line breaks.

Documentation credentials protect both Swagger assets and the specification; they are independent of account JWTs. HTTPS, an internal network, and a configured reverse proxy are deployment concerns. Swagger authorization stays in browser memory and external validators are disabled. The UI does not perform application requests unless interactive submission is enabled and a user explicitly invokes an operation.

## Email and logs

See [notifications](notifications.md) for all delivery, lease, expiry, concurrency, and retry settings. `MAIL_REQUIRE_TLS=true` requires STARTTLS when using submission such as port 587; `MAIL_SECURE=true` selects implicit TLS. The production worker example requires STARTTLS and supplies its credential through a secret file.

`LOG_LEVEL` defaults to `info`. Development console output is readable text; production uses JSON. Warning/error records go to stderr and other enabled levels to stdout. `API_LOG_FILENAME` is a legacy optional sanitized JSON file-output setting shared by runtime logging; leave it unset in read-only containers and collect both streams externally. Early configuration/import failures use an independent stderr reporter even when the logger cannot load. Details and examples are in [logging](logging.md).

## Account, email and media abuse controls

Existing IP budgets remain enabled. `ACCOUNT_RATE_LIMIT_MAX` defaults to 20 attempts per `RATE_LIMIT_WINDOW_MS`, independently for sign-in and password-confirmation operations. Redis atomically counts attempts across IPs and replicas; a rejected attempt does not extend the fixed window. Keys contain an HMAC of the normalized identity rather than an email address. Dependency failures deny admission.

`MAIL_RECIPIENT_DAILY_LIMIT=50` caps all new jobs for a normalized recipient per UTC day; `MAIL_TEMPLATE_DAILY_LIMIT=10` adds a per-template daily cap. `MAIL_SECURITY_COOLDOWN_MS=60000` applies to reset and verification emails. Budgets and new outbox jobs commit in the same MongoDB transaction. Rejected requests roll back account/link changes; reset responses remain generic. Replaying an existing matching idempotency key does not consume another budget. Retries of an already accepted job are governed by its existing delivery-attempt budget, not charged as another producer request. Budget identities are HMACs using the stable queue key; do not rotate keys merely to reset budgets.

`MEDIA_MAX_FILES=20` and `MEDIA_MAX_TOTAL_BYTES=104857600` apply per owner, including attached images, unused images, in-flight uploads, and deletion records whose files could not be removed. Each upload reserves `MAX_UPLOAD_BYTES + 262144` bytes before Multer writes any data, then reduces the original-file charge to its actual size on success. Conversion capacity remains reserved, and generated conversions are explicitly capped at 256 KiB. The total quota must accommodate at least one maximum upload plus its conversion. Owner writes serialize reservations through the existing account mutation lock. Upload receipt has a 60-second deadline; Sharp operations have 30-second timeouts. Upload leases expire after five minutes, allowing crash recovery.

`MEDIA_UNUSED_RETENTION_MS=86400000` retains unattached media for 24 hours by default (minimum one hour). Detaching an avatar refreshes its retention timestamp. Cleanup fences eligible records before unlinking; attachment excludes uploading/deleting records. Deletion failures preserve their records and quota charge for retries. Existing records without a lifecycle status are treated as ready and counted; no account-password or media-data rewrite is required. Provision the new EmailBudget collection/TTL index and media cleanup index with the explicit index command before accepting writes.

These controls are application budgets, not a replacement for a bounded storage volume, provider limits, monitoring, or deployment access controls. The local common-password dictionary is not a complete live breach database, and passwords are never submitted to an external checker.
