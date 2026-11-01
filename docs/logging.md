# Runtime diagnostics and console output

API, email-worker, and operator failures identify the component, stage, stable `code`, readable `reason`, and an actionable `hint`. Unexpected exceptions include an allowlisted error type and development source locations. Operator diagnostics are independent of HTTP response envelopes and client translation keys.

## Formats and streams

| Destination                   | Behavior                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| Development console           | Compact informational lines; multiline warning/error blocks   |
| Production console            | One structured JSON record per event                          |
| Console severity              | Warning/error to stderr; other enabled levels to stdout       |
| `API_LOG_FILENAME`            | Optional sanitized JSON file output in either environment     |
| Early bootstrap / CLI failure | stderr directly, even if configuration or Winston cannot load |
| Queue / OpenAPI result        | Existing stdout JSON contract; diagnostics use stderr         |

`NODE_ENV=production` selects JSON. An absent value defaults to development; an invalid explicit value uses JSON while reporting configuration failure. `LOG_LEVEL` controls initialized Winston output, not early bootstrap failures. File-output errors use the independent stderr reporter; console output remains available. Leave `API_LOG_FILENAME` unset in read-only containers and collect both streams externally.

Illustrative output, not an executed failure scenario:

```text
2026-11-01T12:00:00.000Z ERROR [api] [CONFIG_INVALID] Process operation failed
  Environment configuration is missing or invalid
  stage: configuration
  JWT_SECRET: Required setting is missing. Use a secret with at least 32 characters.
  MAIL_QUEUE_ENCRYPTION_KEY: Required setting is missing. Use exactly 64 hexadecimal characters (32 bytes).
  Action: Fix all listed settings in the process environment or .env, then restart this process.
```

```text
2026-11-01T12:00:00.000Z ERROR [api] [MONGODB_CONNECTION_REFUSED] API startup failed
  MongoDB refused the connection.
  stage: mongodb
  errorType: MongooseServerSelectionError
  sourceCode: ECONNREFUSED
  Action: Check that the service is running and reachable at the configured host/port; inspect container networking and firewall rules.
```

## Configuration before clients

The API and worker entrypoints call bootstrap before importing their process implementation. It imports all configuration profiles for that role with `Promise.allSettled`, combines configuration issues, and stops before loading service clients when configuration is invalid. Successful profiles are reused through ESM caching rather than parsed again.

API profiles include runtime, MongoDB, API/Redis/JWT, notification, queue-encryption, and delivery settings. Worker profiles include runtime, MongoDB, notification, queue-encryption, delivery, and SMTP settings. Database maintenance needs runtime/MongoDB; queue commands validate only MongoDB/delivery after parsing a real command. Queue/OpenAPI help needs no service credentials. OpenAPI export loads no environment profiles or dotenv file and starts no clients.

Issues distinguish missing values, type/enum/format/range failures, related-setting conflicts, conflicting plain/`_FILE` sources, empty secret files, and unreadable files. Output includes setting names and authored requirements, never rejected values, secret-file contents/paths, or raw Zod messages. Validation starts no listener, consumer, or database maintenance.

## Diagnostic categories

| Code / family                                                                 | Interpretation / action                                                                 |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CONFIG_INVALID`                                                              | Correct every listed setting for this role and restart                                  |
| `*_CONNECTION_REFUSED`, `*_DNS_FAILED`                                        | Inspect service availability, host/port, DNS/SRV, containers, and networking            |
| `*_AUTH_FAILED`, `MONGODB_PERMISSION_DENIED`                                  | Inspect credentials, authentication database/ACL, and process-specific roles            |
| `*_TLS_FAILED`                                                                | Correct trust chain, hostname, clock, and TLS mode; retain verification                 |
| `*_TIMEOUT`, `*_CONNECTION_LOST`, `*_NOT_CONNECTED`                           | Inspect connectivity, restarts, readiness, and resource limits                          |
| `MONGODB_UNAVAILABLE`, `MONGODB_TRANSACTIONS_UNAVAILABLE`                     | Check server selection, replica-set/primary readiness, and required transaction support |
| `REDIS_STARTUP_EXHAUSTED`                                                     | Correct the preceding Redis failure and restart; initial retries have ended             |
| `HTTP_PORT_IN_USE`, `PERMISSION_DENIED`                                       | Correct listener conflicts, service-user permissions, or mounts                         |
| `FILE_NOT_FOUND`, `OUTPUT_ALREADY_EXISTS`                                     | Correct required directories/assets or choose a new export filename                     |
| `CONNECTION_CONFIG_INVALID`, `MODULE_NOT_FOUND`                               | Correct the URI or install locked dependencies/rebuild                                  |
| `INDEX_CONFLICT`, `MONGODB_UNIQUE_CONFLICT`                                   | Reconcile data using the migration/index guide                                          |
| `CLI_ARGUMENTS_INVALID`                                                       | Follow command help and documented cursor/status/ID formats                             |
| `EMAIL_TEMPLATE_INVALID`, `EMAIL_TRANSLATION_MISSING`, `EMAIL_RENDER_INVALID` | Repair templates, dictionaries, assets, or render constraints                           |
| `EMAIL_DELIVERY_FAILED`, `EMAIL_DELIVERY_EXPIRED`, `EMAIL_RETRY_SCHEDULED`    | Inspect job ID, `errorCode`, attempts/deadline, and the accompanying action             |
| `SHUTDOWN_TIMEOUT`, `UNEXPECTED_ERROR`                                        | Inspect active work/source locations and safe request/job context                       |

Classification inspects bounded cause chains, aggregate errors, and MongoDB server descriptions. Unknown errors retain a generic category rather than exposing arbitrary driver text. A category is a diagnostic clue, not proof that a specific external service is stopped.

## HTTP, connections, and email

HTTP completion records include method, status, duration, request ID, and the matched route pattern, such as `/user/verification/:accessToken`. Actual token-bearing URLs and query strings are excluded. Failures before route matching use `[unmatched]`. Expected 4xx outcomes use ordinary request records; 5xx failures add diagnostics. After headers are sent, the handler logs safe context and destroys an unfinished response rather than forwarding raw exceptions to Express's default console handler.

MongoDB disconnect/reconnect events are observed only in long-running API/worker processes. Intentional shutdown removes observers before disconnecting. Redis retains bounded initial retries and later automatic recovery; repeated identical error categories are suppressed until a category change or successful connection. Recovery after an established connection is reported. Readiness and retry policies are retained.

Email logs explain existing payload, rendering, temporary/permanent SMTP, configuration/TLS/authentication, connection, and exhausted-budget categories. They retain safe job metadata and `errorCode`, without SMTP responses, recipients, content, or decrypted payloads. See [operations](operations.md) before retrying uncertain SMTP acceptance.

## Safe exception details

Use `errorDiagnostic(error, { component, stage })` and explicitly selected metadata. Do not concatenate raw exception messages/user input into titles, pass entire request/response/driver objects, or enable raw stack serialization. The formatter redacts recognized credential/content fields, URL credentials, bearer strings, sensitive query parameters, known token paths, email addresses, and control characters. This is defense in depth, not permission to log arbitrary values under unrelated names.

Development stacks contain bounded project-relative source locations, preferring application over dependency frames. Raw exception headers, function arguments/names, template excerpts, and external filesystem paths are excluded. Common programming-error categories have authored explanations; production omits source stacks. `DiagnosticError` accepts authored operator-facing reasons only, never raw input or driver messages.

Handling begins once the bootstrap module loads. Unsupported Node executables, broken bootstrap syntax, OS termination, and supervisor/proxy/dependency debug output remain outside this formatter. Reverse-proxy logs still need separate token-URL redaction.

## Implementation status

These changes have local typecheck/lint/build/format evidence. No tests, failure injection, API/worker startup, database command, SMTP request, or connection probe was run for this change. Actual console rendering, driver classification, recovery, and shutdown still need target-environment acceptance when authorized.
