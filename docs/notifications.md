# Background email delivery, templates, and languages

The notification domain persists encrypted email jobs in MongoDB. A separate worker renders registered, server-owned HTML templates and sends them using Nodemailer over SMTP. API responses contain translation keys for the client; only email content is translated on the server.

## Module responsibilities

| Module                | Owns                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| `service.ts`          | Public notification facade and account-enqueue policy                           |
| `registry.ts`         | Registered template definitions and catalog                                     |
| `preparation.ts`      | Notification/variables validation and locale selection                          |
| `utils.ts`            | Pure weighted/regional language matching with explicit defaults                 |
| `renderer.ts`         | Startup file checks, per-render translation resources, HTML/text/subject output |
| `mailer.ts`           | SMTP connections and safe transport-failure classification                      |
| `delivery/service.ts` | Idempotency ID generation, fingerprint/encryption, durable enqueue              |
| `delivery/utils.ts`   | Canonical HMAC fingerprints and AES-GCM payload operations                      |
| `delivery/worker.ts`  | Claims, leases, retry timing, rendering/submission orchestration                |

Producers prepare input before persisting it; workers validate again after decryption before rendering. These are distinct trust/version boundaries, not redundant calls to remove. Language matching does not load environment configuration itself; preparation supplies the configured default and template fallback. Each render copies locale dictionaries before applying per-message overrides.

## Sending and delivery

Configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_FROM`, and, when required, `MAIL_USER` and `MAIL_PASSWORD`. Credentials must be supplied together. `MAIL_SECURE=true` selects implicit TLS; STARTTLS normally uses `false`. SMTP credentials are supplied through the environment, not through request bodies.

Account workflows insert the email job in the same MongoDB transaction as the account/token changes. If enqueueing fails, the business transaction rolls back. A rolled-back transaction never produces a visible job. HTTP responses await persistence, while rendering and SMTP run in the separate worker. MongoDB writes use majority acknowledgement and transactions use snapshot reads on the primary.

`notificationService.enqueueTemplate` persists a job and returns a delivery receipt without waiting for SMTP. Built-in account workflows use `notificationService.enqueueAccount(template, options, session)` to apply the shared ownership/purpose/variable policy. Rendering/SMTP errors are recorded by the worker after the original request completes. `sent` means SMTP accepted the message; inbox delivery and provider bounce/webhook tracking are outside this module.

### Account notifications

Call the canonical account operation inside the owning business transaction:

```ts
await notificationService.enqueueAccount(
  'successfullyUpdatedProfile',
  { email: user.email, language, ownerId: user.id },
  session
)
```

The template argument is `AccountTemplateDto`, inferred from `accountTemplateSchema`. Its eight keys are also the registry's built-in manifest. Reset and verification templates require an `accessToken` in the options and receive their matching delivery purpose; the others receive `account`. Supply `expiresAt` for security-link jobs to keep their delivery deadline within token validity. The operation always requires the caller's MongoDB session.

There are no separate `signUp`, `resetPassword`, `verification`, or `successfully…` methods and no `sendTemplate` alias. Custom registered keys use `enqueueTemplate(input, context)`. Template keys stored in existing jobs remain unchanged.

### Worker deployment

1. Generate a persistent random key (for example, `openssl rand -hex 32`) and set `MAIL_QUEUE_ENCRYPTION_KEY` in the API and every worker. Do not rotate it on each restart. Keep the key separate from the database and JWT secret.
2. Create the `email_outbox` and `email_workers` collections and declared indexes with `yarn db:indexes` before enabling account traffic or workers. This is an additive index operation; startup does not execute maintenance scripts.
3. Run `yarn dev` and `yarn dev:mail` as separate development processes. Host checkouts use `yarn start` and `yarn start:mail` from the same compiled artifact; containers invoke `node dist/index.js` and `node dist/app/runtime/mail/worker.js` directly. A process supervisor must restart the worker after crashes.
4. Deploy identical template definitions, dictionaries, client URL, encryption key, and Message-ID domain to all instances. The worker needs MongoDB and SMTP access; it does not connect to Redis or expose HTTP. Configuration is split by role: the worker does not require a JWT secret or Redis URI; queue metadata commands require MongoDB only.

Jobs remain durable when workers are offline. Multiple worker processes can share the collection: atomic claims assign a unique lease token, heartbeats renew leases, and all acknowledgements require the same unexpired lease. A crashed worker's jobs become claimable after lease expiry. SIGINT/SIGTERM stop new claims and drain active work up to the worker shutdown deadline; unfinished jobs recover through their leases.

| Variable                          | Default                     | Purpose                                                      |
| --------------------------------- | --------------------------- | ------------------------------------------------------------ |
| `MAIL_QUEUE_ENCRYPTION_KEY`       | Required, 64 hex characters | AES-256-GCM key shared by producers and consumers            |
| `MAIL_MESSAGE_ID_DOMAIN`          | `notifications.local`       | Stable Message-ID domain; configure a domain you control     |
| `MAIL_QUEUE_MAX_ATTEMPTS`         | `8`                         | Processing attempt budget, including recovered leases        |
| `MAIL_QUEUE_MAX_AGE_MS`           | `86400000`                  | Maximum age of an unsent job; explicit expiry can shorten it |
| `MAIL_QUEUE_RETENTION_MS`         | `604800000`                 | Terminal metadata/encrypted-failure retention                |
| `MAIL_WORKER_HEARTBEAT_MS`        | `10000`                     | Worker metadata reporting interval                           |
| `MAIL_WORKER_STALE_MS`            | `45000`                     | Fresh-running-worker cutoff                                  |
| `MAIL_WORKER_CONCURRENCY`         | `2`                         | Active jobs/SMTP pool connections per worker process         |
| `MAIL_WORKER_POLL_MS`             | `1000`                      | Idle/database-failure polling interval                       |
| `MAIL_WORKER_LEASE_MS`            | `60000`                     | Lease lifetime; renewed every third of this interval         |
| `MAIL_WORKER_SHUTDOWN_TIMEOUT_MS` | `60000`                     | Maximum graceful worker shutdown time                        |
| `MAIL_RETRY_BASE_DELAY_MS`        | `30000`                     | Initial exponential retry ceiling                            |
| `MAIL_RETRY_MAX_DELAY_MS`         | `3600000`                   | Maximum exponential retry ceiling                            |

Retries add equal jitter (half to all of the current delay ceiling). Temporary SMTP responses and connection failures retry within the attempt/expiry budget. Permanent responses, invalid envelopes, authentication/TLS configuration errors, invalid encrypted payloads, and template-render errors become terminal failures. Correct the cause before manually retrying. The SMTP pool's in-memory requeue mechanism is disabled so the outbox owns retry scheduling. Set aggregate concurrency across replicas within your provider's limits, and keep host clocks synchronized for lease/expiry comparisons.

### Delivery guarantees and sensitive data

This is a brokerless transactional outbox: MongoDB stores both business data and durable delivery work, avoiding a second database-to-broker write. No additional broker or queue dependency is required. The design follows the [transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

Delivery is **at least once**, with bounded attempts. A crash after SMTP acceptance and before the database acknowledgement can cause a duplicate. Every attempt uses the job's stable Message-ID; SMTP provides no portable exactly-once guarantee. Separate jobs are not guaranteed to reach inboxes in order, especially during retries or with several workers.

Email addresses, locale, variables, tokens, and per-message translations are AES-256-GCM encrypted. Authenticated data binds ciphertext to the job ID. Queue metadata and logs contain template keys, IDs, safe error categories, counters, and timestamps rather than recipients or message content. The encrypted input is limited to 256 KiB; rendered HTML/text also have size limits. Successful, cancelled, and expired jobs discard their payload. Failed jobs retain ciphertext for manual recovery until TTL cleanup. Pending jobs also have a bounded cleanup deadline after expiry, even if no worker runs.

A single active encryption key is supported. Rotation requires draining pending jobs and allowing retained failed/idempotency records to expire, or a separately planned key migration. Replacing the key without migration makes old jobs unreadable. Backups containing outbox records must follow the same secret/retention policy.

New reset/verification requests cancel older unsent jobs of that purpose within their transaction. Password/email changes invalidate pending security-link jobs; account deletion cancels all earlier unsent jobs owned by that account. Expired jobs never start SMTP delivery. Cancellation cannot retract a message already handed to SMTP, and there remains a race between the final cancellation check and transmission; token validity remains enforced by the authentication domain.

### Status and recovery

Server code can use `notificationService.getDelivery(id)` to read a DTO with status, attempt budget, timestamps, and a safe `lastErrorCode`. States are `queued`, `processing`, `sent`, `failed`, `cancelled`, and `expired`. These methods have no public HTTP endpoint and expose no recipient or decrypted content.

After fixing a provider/template/configuration issue, `notificationService.retryFailed(id)` atomically resets a still-unexpired failed job to `queued`, using the same Message-ID. It returns `null` for jobs that cannot be retried. Cancelled/expired jobs cannot be revived. Manual retry resets the attempt budget. Use the [queue CLI and heartbeat guide](operations.md) to inspect metadata, retry jobs, and monitor oldest pending age and terminal failures. API readiness describes MongoDB/Redis, not worker progress. See [deployment](deployment.md) for the separate process/container setup.

## Language selection

HTTP account workflows forward the request's `Accept-Language` header to the notification service. CORS permits this header. For example:

```http
Accept-Language: ka-GE, ka;q=0.9, en;q=0.7
```

Enqueueing resolves and persists the chosen locale. Language matching considers positive `q` values in priority order, matches a supported language, and falls back from a regional preference such as `ka-GE` to `ka`. With no matching preference, it tries `MAIL_DEFAULT_LANGUAGE` (default `en`), then the registered template's `defaultLanguage`. Language matching happens separately for each template. Built-in dictionaries support `en` and `ka`.

The frontend should send the language the user selected in its interface. Browser defaults are useful when no explicit preference exists. This header affects emails triggered by the request; API `messageKey` values stay unchanged.

Server workflows without an HTTP request pass an explicit locale through `language`; the queue persists it with the job. A stored recipient language preference would be useful for scheduled notifications; the current user model does not store one.

## Template catalog

Authenticated clients can request `GET /notifications/templates` with their bearer token. The response lists registered keys and their languages:

```json
{
  "data": {
    "templates": [
      {
        "key": "verification",
        "languages": ["en", "ka"],
        "defaultLanguage": "en"
      }
    ]
  },
  "messageKey": "notifications.templates_listed",
  "status": 200
}
```

The catalog contains metadata rather than HTML, filesystem paths, or translation dictionaries. Server code can import `listEmailTemplates` from the notification domain's `index.ts` to obtain the metadata array; the small HTTP handler in `routes.ts` wraps it as `{ templates }` after the auth guard. It needs no separate controller/service forwarding method. Sending is an application-service operation; there is no generic public HTTP endpoint accepting arbitrary recipients and HTML.

## Registering custom HTML

Built-in templates each have their own kebab-case folder with `html.ejs`, `content.ejs`, and `text.ejs`. The HTML wrapper combines the shared layout with the template's own body and translated preheader; text output uses the template's `text` resource. See the [template catalog and folder structure](../src/domains/notifications/templates/README.md) for all eight keys and editing instructions. Layout/buttons use presentation tables and inline CSS following the [Mailchimp email HTML guidance](https://templates.mailchimp.com/development/html/).

Store templates under `src/domains/notifications/templates/`. The build copies the entire directory into the compiled domain. `.html` and `.ejs` files use EJS rendering, so a custom HTML file can contain escaped variables and translated text.

Add application-owned definitions to `src/domains/notifications/registry.ts`, after the built-in registration loop. For example, register `customWelcome`:

```ts
registerEmailTemplate({
  key: 'customWelcome',
  htmlFile: 'custom-welcome/html.html',
  defaultLanguage: 'en',
  variablesSchema: z.object({ firstName: z.string().min(1).max(48) }),
  translations: {
    en: {
      subject: 'Welcome, {{values.firstName}}',
      title: 'Welcome',
      body: 'Your account is ready.',
      text: 'Welcome, {{values.firstName}}. Your account is ready.'
    },
    ka: {
      subject: 'მოგესალმებით, {{values.firstName}}',
      title: 'მოგესალმებით',
      body: 'თქვენი ანგარიში მზად არის.',
      text: 'მოგესალმებით, {{values.firstName}}. თქვენი ანგარიში მზად არის.'
    }
  }
})
```

`z` and `registerEmailTemplate` are already available inside the registry module. Alternatively, import the public registration function from the notification domain's `index.ts` and register during application composition, before the worker initializes template files. Register once per process. Duplicate keys are rejected; intentional replacement uses `registerEmailTemplate(definition, { replace: true })`.

The registry supplies shared layout strings (`footerLabel`, `fallbackLinkLabel`) in English and Georgian, with the template default language or English as fallback for other locales. Per-template dictionaries and per-message overrides can replace them. `accountTemplateSchema` explicitly lists the built-in keys; the registry iterates that manifest and supplies action paths for reset/verification. Translation metadata such as the shared `layout` dictionary never creates a template by itself.

Create `templates/custom-welcome/html.html`:

```html
<!doctype html>
<html lang="<%= language %>" dir="<%= direction %>">
  <head>
    <meta charset="utf-8" />
    <title><%= t('title') %></title>
  </head>
  <body>
    <h1><%= t('title') %>, <%= data.firstName %></h1>
    <p><%= t('body') %></p>
  </body>
</html>
```

Render locals are `data`, `t`, `language`, `direction`, `clientUrl`, and optional `actionUrl`. `data` contains variables parsed by that template's Zod schema. Use `<%=` for translated text and dynamic values so EJS escapes HTML. `<%-` emits raw markup and is used by the built-in trusted layout include. Template files contain executable server-side EJS and belong to application code; API callers do not upload template source.

The registration requires a subject translation and a plain-text translation in the default language. The default keys are `subject` and `text`, configurable through `subjectKey` and `textKey`. Alternatively, set `textFile` to an EJS-rendered plain-text file; then a `text` dictionary entry is optional. Both HTML and text are included in each outgoing email. Missing translation lookups fail rendering instead of sending raw keys.

Set `MAIL_TPL_PATH` to use another server-owned root directory. Relative paths resolve from the project root. Registered filenames are relative to that directory and cannot traverse outside it. An override must contain files for every registered template, including built-ins unless replaced. Worker startup checks that registered HTML/text entry files exist before claiming jobs; this does not render them or validate their includes/dictionaries. Missing partials, syntax problems, or missing translation lookups can still cause a later `render.failed`. API producers do not render templates or access SMTP during requests.

## Sending by key

From an owning domain service, import the notification domain's public API:

```ts
import { notificationService } from '../notifications/index.ts'

const receipt = await notificationService.enqueueTemplate(
  {
    template: 'customWelcome',
    email: 'recipient@example.com',
    language: 'ka',
    variables: { firstName: 'Vacho' },
    translations: {
      ka: { subject: 'კეთილი იყოს თქვენი მობრძანება, {{values.firstName}}' }
    }
  },
  { options: { idempotencyKey: 'welcome:account-id:registration-event-id' } }
)

const delivery = await notificationService.getDelivery(receipt.id)
```

The template key and variables are validated before persistence. A new job returns `{ id, status: 'queued' }`. The optional idempotency key is application-scoped: namespace it by event/recipient/template. Identical re-enqueueing returns the existing receipt while its record exists; reusing the same key with different input yields `notifications.idempotency_conflict`. It does not make the surrounding business operation idempotent. `language` accepts a locale or weighted language preferences. `translations` is optional: flat string dictionaries by locale are merged with that template's dictionaries for this email only. Overrides can add a locale, with missing keys falling back to the template's default language. They never mutate other messages or the shared registry.

Interpolation uses `{{values.firstName}}` for template variables. `values.email`, `values.clientUrl`, and `values.actionUrl` are provided by the renderer. `t(key, values)` can add interpolation values for one lookup. Templates are rendered by the worker using its deployed files and dictionaries, not snapshotted HTML. Keep template keys and variable schemas compatible with pending jobs during deployments. Email translations are template-local resources; they do not define the frontend's API message translations.

For a custom business workflow, pass its MongoDB session through the enqueue context so the job commits with the business changes:

```ts
await notificationService.enqueueTemplate(input, {
  session,
  options: {
    ownerId: account.id,
    purpose: 'custom',
    idempotencyKey: `account:${account.id}:event:${eventId}`,
    expiresAt: deadline
  }
})
```

Use a stable event key across retries. `enqueueAccount` requires a session and associates jobs with the account so obsolete security notifications can be cancelled. Generic `enqueueTemplate` without a session is an independent durable write for workflows that have no accompanying business mutation. Concurrent transactional callers contending on an idempotency key must handle transaction conflicts and retry their owning operation.

`notificationService.renderTemplate(input)` returns the rendered DTO (`email`, `template`, `language`, `subject`, `html`, `text`) without sending. It is a server API and is not exposed through an HTTP preview endpoint.

HTML/text files can be cached by EJS in production. Template, registry, dictionary, and configuration updates require restarting the affected processes; do not rely on editing a mounted file to update a running worker. Keep schemas compatible with retained jobs, or plan their expiry/cancellation and replacement before removing a template key.

## References

- [Nodemailer SMTP error classification](https://nodemailer.com/errors)
- [MongoDB atomic operations](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
- [Nodemailer message fields: HTML and plain text](https://nodemailer.com/message)
- [i18next language fallback](https://www.i18next.com/principles/fallback)
- [EJS escaping and includes](https://ejs.co/)
