# Client integration and API workflows

This guide describes the current API for frontend, mobile, and other HTTP clients. Use [Swagger/OpenAPI](openapi.md) for complete field schemas and operation descriptions, and the [README](../README.md#api-examples) for a short curl walkthrough. The frontend itself is not included in this repository.

## Request and response contract

Use the configured public API base, JSON for ordinary request bodies, and `Authorization: Bearer <JWT>` when authentication is required. Uploads use multipart form data. The current application operations return HTTP `200` on success, with:

```json
{
  "data": { "accessToken": "<JWT>" },
  "messageKey": "auth.signed_in",
  "status": 200
}
```

Operations without a data payload omit `data`. Errors contain `messageKey`, numeric `status`, and optional validation `details`; translate keys on the client as described in [API message keys](api-message-keys.md). Use the actual HTTP status to branch success/failure. Health responses and static image resources have separate formats.

Unknown JSON fields are stripped by ordinary object schemas. This is not permission to send arbitrary fields: use the documented body contract. Email identities are trimmed/lowercased without provider-specific alias rewriting. New passwords are 6–48 characters and at most 72 UTF-8 bytes. Profile names are trimmed to 2–48 characters. JSON/form bodies have a 100 KiB parser limit.

## Current operations

Access labels:

- **Guest:** omit Authorization; an authenticated request is rejected with `403`.
- **Bearer:** requires a current account JWT.
- **Link:** the single-use token in the path authorizes the action; a bearer token is not required. Omit Authorization to avoid rejection of stale credentials or ambiguity about which account the link affects.

Any invalid supplied Authorization header is rejected before an application operation, including those allowing anonymous access. In the table, **none** means no `data` property, not an empty JSON object.

| Method / path                          | Access | Body / input                                        | Success data / message key                                                                |
| -------------------------------------- | ------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /auth/sign-up`                   | Guest  | `{ email, password }`                               | `{ accessToken }` / `auth.signed_up`                                                      |
| `POST /auth/sign-in`                   | Guest  | `{ email, password }`                               | `{ accessToken }` / `auth.signed_in`                                                      |
| `POST /auth/sign-out`                  | Bearer | No body required                                    | none / `auth.signed_out`                                                                  |
| `GET /auth/sign-out`                   | Bearer | Deprecated compatibility route                      | none / `auth.signed_out`                                                                  |
| `POST /auth/password/reset`            | Guest  | `{ email }`                                         | none / `auth.password_reset_requested`                                                    |
| `POST /auth/password/new/:accessToken` | Link   | `{ password }`                                      | `{ accessToken }` / `auth.password_updated`                                               |
| `GET /me`                              | Bearer | No body                                             | Public account DTO, optional names/image / `users.profile_loaded`                         |
| `POST /user/verification/request`      | Bearer | `{ email }`, matching the account's current email   | none / `auth.verification_requested`                                                      |
| `GET /user/verification/:accessToken`  | Link   | Single-use token in path                            | `{ accessToken }` / `auth.email_verified`                                                 |
| `POST /user/update`                    | Bearer | `{ firstName, lastName }`, both required            | `{ firstName, lastName }` / `users.profile_updated`                                       |
| `POST /user/update/email`              | Bearer | `{ email, password }`, password confirms the action | `{ email, accessToken? }` / `auth.email_update_completed`                                 |
| `POST /user/update/password`           | Bearer | `{ oldPassword, newPassword }`                      | `{ accessToken }` / `auth.password_updated`                                               |
| `POST /user/update/avatar`             | Bearer | `{ imageId }`, owned uploaded image                 | none / `media.avatar_updated`                                                             |
| `POST /user/delete`                    | Bearer | `{ password }`                                      | none / `users.profile_deleted`                                                            |
| `POST /media/image/upload`             | Bearer | One multipart field `file`, JPEG/PNG                | `{ id, image }` / `media.image_uploaded`                                                  |
| `GET /notifications/templates`         | Bearer | No body                                             | `{ templates: [{ key, languages, defaultLanguage }] }` / `notifications.templates_listed` |

Use POST sign-out for new clients. The verification GET consumes a token and mutates account state; it is a compatibility endpoint, not a safe read/preview operation. There is no public arbitrary-recipient mail endpoint, queue administration endpoint, refresh-token endpoint, or cookie-session login flow.

Express also dispatches HEAD to these legacy GET handlers. Do not probe or prefetch sign-out/verification links with GET or HEAD. Body-based application routes accept JSON or flat `application/x-www-form-urlencoded` fields; image upload requires multipart form data.

### Common failure outcomes

| Status | Meaning / handling                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Invalid body/parameters or disallowed action; show field errors when present                                                       |
| `401`  | Missing, malformed, expired, revoked, or superseded JWT, or invalid sign-in credentials; distinguish the operation and message key |
| `403`  | Guest-only/policy/password-confirmation failure, or expired/invalid single-use link                                                |
| `404`  | Missing route/resource, including an image that is absent or not owned                                                             |
| `409`  | Unique conflict, such as an already registered email                                                                               |
| `413`  | Parser/upload byte limit exceeded                                                                                                  |
| `415`  | Unsupported request charset/content encoding; image MIME/content failures instead return `400`                                     |
| `429`  | Rate limit; respect `Retry-After` and avoid request loops                                                                          |
| `500`  | Internal/dependency failure; show a generic client message and retain a safe request ID for support                                |

The exact operation can expose additional documented failures. Do not display raw machine keys as prose or treat every `401` from a guest sign-in attempt as an expired existing session.

## JWT lifecycle

Save `data.accessToken` after registration/sign-in. Send it only where appropriate; use a guest client/request path that omits Authorization for registration, sign-in, and reset requests.

| Event                                                 | Required client action                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Password change or password-reset completion          | Replace the stored JWT; earlier account JWTs are invalidated                                           |
| Email address actually changes                        | Replace the returned JWT, reload the profile, and show the verification workflow for the new address   |
| Email update requests the existing normalized address | `data.accessToken` can be absent; preserve the current JWT                                             |
| Verification link is consumed                         | Save the returned JWT and reload the profile; earlier JWTs are invalidated                             |
| Sign-out succeeds                                     | Discard the local JWT; the server revokes that token until its expiry                                  |
| Account deletion succeeds                             | Discard local credentials and account state                                                            |
| Protected request returns `401`                       | Stop protected retry loops and require reauthentication or handle a known concurrent token replacement |

Sign-out revokes the presented token, not every session for the account. Security mutations increment the account version and invalidate prior JWTs across sessions. JWT issuer/audience/expiry are configured on the API; clients do not need the signing secret and must never receive it.

The API supplies bearer authentication; token storage and browser session policy belong to the consuming application. Do not log JWTs, put them in URLs, or assume a refresh-cookie mechanism exists. A lost response to a mutation can be ambiguous: do not automatically replay all POST requests. Sign in again or reconcile the account state through the appropriate workflow rather than assuming the first mutation rolled back.

## Verification and reset links

Built-in email templates create frontend URLs from `CLIENT_URL`:

| Email          | Frontend route                              | API action                                                 |
| -------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Verification   | `<CLIENT_URL>/verification/<email-token>`   | `GET /user/verification/:accessToken`                      |
| Password reset | `<CLIENT_URL>/reset-password/<email-token>` | `POST /auth/password/new/:accessToken` with `{ password }` |

The frontend must implement these pages. The API does not serve a verification/reset form. Email tokens are 96-character hexadecimal values, distinct from the JWT returned on success.

Handle a link as an explicit user workflow. Do not use verification's consuming API URL as a prefetch/preview request or trigger repeated automatic requests while rendering a page. Reset submits only after the user provides a new password. On success, replace the JWT and remove the one-time token from the current URL/history according to the client routing behavior; avoid collecting it in analytics or access logs.

Reset tokens expire one day after issuance; verification tokens expire after seven days. A newer link replaces the older one. Consumption is single-use: a well-shaped but invalid/expired/used token returns `403` with `auth.invalid_or_expired_token`; malformed path tokens fail schema validation with `400`. Offer a fresh-link workflow; repeatedly submitting the old link will not recover it.

`POST /user/verification/request` takes the authenticated account's current email. A different email produces `400` with `auth.email_change_requires_password`; use the password-confirmed email-change endpoint instead. Reset requests return the same success envelope whether the account exists, so display a neutral confirmation.

The queue's default maximum unsent age is one day and can further limit delivery, independently of token lifetime. Email delays do not extend token validity. An API success confirms transaction persistence, not receipt of the email.

## Browser requests, languages, and uploads

### CORS and language

CORS allows the origin derived from `CLIENT_URL`, methods GET/POST/OPTIONS, and headers Authorization/Content-Type/Accept-Language. Use the configured frontend origin, including its scheme and port. `APP_URL` describes the public API base; it does not change which browser origin is allowed.

Send the interface language with requests that trigger email:

```http
Accept-Language: ka-GE, ka;q=0.9, en;q=0.7
```

The chosen supported locale is saved with the job. Unsupported preferences fall back to configured/template defaults. API message keys remain unchanged; only the client's displayed text and server-rendered email content are localized. See [notifications](notifications.md#language-selection).

### Upload and attach an avatar

1. Send one JPEG/PNG `file` with `POST /media/image/upload` and a bearer token. Do not append other multipart fields.
2. Read `data.id` and `data.image`; uploading alone does not set the avatar.
3. Send `{ imageId: data.id }` to `POST /user/update/avatar` with the same owner's current token.
4. Reload `/me` for the account's current `image` URL.

With browser `FormData`, let the browser set Content-Type and the multipart boundary:

```js
const form = new FormData()
form.append('file', selectedFile)

const response = await fetch(`${apiBase}/media/image/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: form
})
```

Here `apiBase`, `accessToken`, and `selectedFile` come from the consuming application. This snippet is illustrative, not an executed upload.

The default file limit is 10 MiB. Decoded content must match JPEG/PNG, be single-frame, and fit the 40-million-pixel decode limit. Public conversions target 150×150 WebP without enlarging small originals, so small images can produce smaller output. Original uploads remain private. Avatar replacement detaches the old image without deleting it; there is no public standalone image-deletion route.

## Correlation and retries

The server generates `X-Request-Id`; browser clients can read it together with RateLimit and Retry-After. `RateLimit-Policy` is also sent on limited responses but is not exposed by the current CORS configuration. Health endpoints bypass limiting. Use request IDs for support correlation without copying Authorization headers, reset/verification URLs, passwords, or email content into diagnostics.

An outbox idempotency key is a server-side notification feature; it does not make every account endpoint idempotent. There is no generic HTTP Idempotency-Key contract on these routes. Retrying after network loss requires operation-specific reconciliation. SMTP acceptance and inbox delivery also have different guarantees; the [operations guide](operations.md) explains the observable job states.
