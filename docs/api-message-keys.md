# API message keys

Clients translate API messages. Success and error envelopes contain a stable `messageKey` rather than translated `message` text. The HTTP status code and numeric `status` field continue to describe the result.

See [client integration](client-integration.md) for the current route/payload map, JWT replacement, frontend email links, and upload workflow.

```json
{
  "messageKey": "auth.invalid_credentials",
  "status": 401
}
```

Successful envelopes can include `data`. Errors can include validation `details`:

```json
{
  "messageKey": "validation.failed",
  "status": 400,
  "details": [
    {
      "path": "firstName",
      "messageKey": "validation.too_small",
      "params": { "min": 2, "inclusive": true, "origin": "string" }
    }
  ]
}
```

Each issue has a dotted field `path`, a translation key, and optional scalar interpolation parameters. Rejected input and Zod's English messages are not returned. Custom schema errors can use semantic keys such as `auth.password_max_bytes` with `{ max: 72 }`. Generic issues use `validation.<zodIssueCode>` and can include `min`, `max`, `inclusive`, `origin`, `format`, or `expected` where applicable.

The frontend owns dictionaries for keys such as `auth.signed_in`, `auth.invalid_credentials`, `users.profile_updated`, `users.email_taken`, `media.image_uploaded`, `validation.failed`, and `validation.too_small`. Unspecified status messages use `http.status.<statusCode>`, for example `http.status.404` or `http.status.500`. Unknown keys should have a client-side generic fallback.

For example, with the client's translation library:

```ts
const message = i18n.t(response.messageKey)
const issues = response.details?.map(issue => ({
  path: issue.path,
  message: i18n.t(issue.messageKey, issue.params ?? {})
}))
```

Do not display keys directly as user-facing prose. Business logic should use status codes and documented machine keys rather than compare translated strings. Health endpoints keep their machine-readable health payloads rather than the message envelope.

`Accept-Language` does not translate API responses. It selects the language of emails triggered by account workflows. Server dictionaries in the notification domain are only for [email content](notifications.md).
