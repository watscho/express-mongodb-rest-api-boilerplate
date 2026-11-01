# OpenAPI and Swagger UI

The API exposes an OpenAPI **3.1.2** document and locally hosted Swagger UI. Domain-owned `documentation.ts` modules describe operations next to their controllers/schemas. Application HTTP composition assembles the document; no runtime route scraping or controller execution is involved. Auth composes verification documentation just as its router composes verification routes; register the parent only.

## Enable documentation

Set `DOCS_ENABLED=true`, then start the API through the normal operator workflow. Visit `/docs/`. The specification is available at `/openapi.json` and `/docs/openapi.json` while enabled. Disabled documentation routes fall through to the regular 404 handler.

In production, also configure dedicated `DOCS_USERNAME` and `DOCS_PASSWORD` or `DOCS_PASSWORD_FILE` values. They protect all documentation assets/config/specification through HTTP Basic authentication. They are separate from the bearer tokens used by application endpoints. Terminate HTTPS at the reverse proxy; do not expose production Basic authentication over plaintext HTTP.

Swagger UI assets are served from the pinned `swagger-ui-dist` dependency, not a public CDN. Its configuration disables the remote schema validator, query-string configuration overrides, credential persistence, and cookie-based API requests. Documentation uses a route-specific CSP, retaining the application's other security headers.

## Interactive requests

`DOCS_TRY_IT_OUT_ENABLED=false` disables supported submit methods. Enabling this setting exposes manual API execution; it is independent of merely viewing schemas. The UI does not automatically create accounts, upload files, send notifications, or exercise endpoints.

Use Swagger's Authorize action with an account bearer token for authenticated operations. Guest-only operations omit a token; a valid authenticated request to them is rejected with `403`. Public application operations allow anonymous access or a valid bearer token, expressed as alternative security requirements. All application routes reject invalid supplied credentials with `401`. The initializer loads protected docs with browser credentials, then uses `credentials: omit` for application calls so docs Basic credentials are not reused as API authentication. Account JWTs are sent explicitly in Authorization when selected.

## Specification coverage

The document describes 18 explicitly registered operations across 17 paths: authentication, password reset/change, account mutation/deletion, email verification, profile reads/updates, multipart image upload, avatar attachment, the template catalog, and liveness/readiness. It includes:

- Operation IDs, tags, descriptions, and deprecated sign-out GET behavior.
- Required/optional bearer authentication and guest-only constraints.
- Zod-derived request/response DTOs, JSON and flat URL-encoded bodies, and multipart file shape/content types.
- Single-use token path parameters and email-only `Accept-Language` behavior.
- Translation-key error envelopes and validation details.
- Request-ID, no-store cache policy, authentication-challenge, and draft-8 rate-limit response headers.
- Queue persistence versus SMTP/inbox delivery semantics.
- JWT replacement and token invalidation after sensitive mutations.

Generated schemas use native `z.toJSONSchema` with the JSON Schema 2020-12 dialect supported by OpenAPI 3.1. Requests/path parameters use input semantics; responses and reusable response components use output semantics. This distinguishes accepted unknown request fields from the fields emitted by response contracts. Email format/length are explicitly retained across the normalization pipe, and password fields are marked write-only with password format. Template-catalog locales describe already canonical strings without rerunning the registration normalizer. Semantic refinements such as the 72-byte bcrypt limit, ownership, matching passwords, and one-time expiry remain enforced by application schemas/services and are described in prose; OpenAPI cannot fully express them.

Application operations share `400`, `401`, `413`, `415`, `429`, and `500` outcomes from global parsing/authentication/limiting/error handling. `413` includes the 100 KiB JSON/form parser limit and the configured upload-file limit. `415` concerns unsupported parser charset/content encoding; unsupported image MIME, corrupt images, and MIME/content mismatches return `400`. Guest-only rejection and password/token policies add `403` only where applicable; avatar lookup adds `404`, and duplicate-email workflows add `409`. Rate-limit headers can be absent when a request fails before a limiter completes.

Health endpoints intentionally have their own status payloads. Public image conversion URLs are runtime/configuration-dependent static resources rather than JSON API operations. Queue administration and arbitrary email sending have no public HTTP endpoint.

Readiness `200` contains only `status: 'ready'`; `503` contains `status: 'unavailable'`. Health routes bypass account authentication and rate limiting, but retain request IDs and no-store headers. Express's implicit HEAD handling for GET routes and CORS OPTIONS handling are not separate business operations in this document. Legacy sign-out/verification GET handlers also run for HEAD; never probe or prefetch those state-changing URLs.

For a readable method/path/payload map and token/link workflows without starting Swagger, see [client integration](client-integration.md). New domains are registered separately in the HTTP router and OpenAPI assembly; the [developer guide](development.md#connect-the-domain-to-the-application) shows both integration points.

## Export for clients/tooling

```sh
yarn docs:export --output openapi.json
yarn docs:export --server https://api.example.com/api --output openapi-client.json
# Production artifact:
yarn docs:export:prod --output openapi.json
```

Export imports only pure schemas/documentation and public package metadata. It does not require or connect to MongoDB, Redis, SMTP, or the API. Without `--output`, JSON is written to stdout. Existing files are never overwritten implicitly (`wx`); use a new path or deliberately remove the obsolete artifact. The live server uses the path portion of `APP_URL` so a reverse-proxy prefix remains visible in the docs server URL.

Use `--output` to keep the artifact separate from any tooling diagnostics. The pinned Yarn 4 forwards script output; automation and runtime containers can invoke `node dist/app/runtime/commands/openapi.js` directly after building, independently of a package-manager launcher. The export defaults to server `/`; it does not read `APP_URL`, so pass `--server` explicitly for the intended public base. Its output directory must already exist.

## Maintaining the reference

When changing an endpoint, update its owning Zod DTO/schema and domain documentation metadata together. Keep descriptions aligned with transaction/authorization behavior. The shared HTTP helper constructs envelopes/errors consistently. A new feature belongs in its domain, and its operation metadata is composed in `app/http/documentation/document.ts`.

`operation()` requires `access: 'authenticated' | 'guest' | 'public'`. Set `params` to the actual route parameter schema, `body` to its validated JSON/form schema, and `response` to the emitted data schema. An explicit native `requestBody` handles multipart or custom media types and cannot be combined with `body`. The current `body` shortcut describes both configured parsers and fits flat form-compatible contracts; use an explicit request body for a JSON-only/nested contract. `emailLanguage: true` documents only Accept-Language; describe transactional/email behavior in the operation's own prose. Mark legacy/deprecated variants on the resulting OpenAPI operation.

Routers still own handler order, guards, limiters, and validation. Metadata does not install middleware or authorize an operation. Review method/path pairs, access mode, parsed schemas, actual response keys/data, and domain-specific failures together; no second routing framework or automatic route discovery is introduced.

Local TypeScript 7 typecheck, build, ESLint, and Prettier passed. The compiled exporter generated a temporary OpenAPI JSON artifact containing 18 operations across 17 paths; static source inspection found no missing or extra explicit method/path pairs. This generation started no API, database, Redis, or SMTP client. No tests, schema-validator suite, UI/browser session, or API call was run. Generated client compatibility and browser rendering remain unverified.

## References

- [OpenAPI 3.1.2 specification](https://spec.openapis.org/oas/v3.1.2.html)
- [Zod JSON Schema conversion](https://zod.dev/json-schema)
- [Swagger UI configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)
