# Security best-practices review

Date: 2026-11-04. Source snapshot: commit dd140d8115c6dd9e77faf77702d14521c294304c.

## Summary

The static review identified **3 Medium findings and 1 Low finding**. The main risks concern accumulated uploads, distributed abuse of authentication/email operations, and a weak policy for new passwords. No Critical or High vulnerabilities were established in the reviewed flows; this does not establish the absence of other vulnerabilities or the security of a production deployment.

| ID      | Severity | Finding                                                             | Priority                                     |
| ------- | -------- | ------------------------------------------------------------------- | -------------------------------------------- |
| SBP-001 | Medium   | Uploads lack cumulative quotas and unused-file cleanup              | Before enabling public uploads               |
| SBP-002 | Medium   | Authentication and email limits are keyed only by IP                | Before enabling public registration/recovery |
| SBP-003 | Medium   | New passwords can contain only six characters                       | Before onboarding real users                 |
| SBP-004 | Low      | Registration responses and execution paths disclose email existence | Alongside an authentication-contract change  |

Existing controls include HS256 with explicit algorithm, issuer, audience, and JWT expiry constraints; authVersion checks; single-use hashed email tokens; transactional account changes; AES-GCM outbox encryption; media ownership checks; JPEG/PNG content validation; file-size/pixel limits; safe public DTOs; and sanitized logs. These controls were considered when assessing the findings.

## Scope and method

- Backend: TypeScript 7, Node.js, Express 5, Mongoose/MongoDB, Redis, Zod, jsonwebtoken, bcrypt, Multer/Sharp, Nodemailer, and EJS/i18next.
- The browser surface in this repository consists of Swagger UI and its small JavaScript initializer. There is no separate client application here.
- Reviewed HTTP/middleware composition, auth/verification/users/media/notifications domains, the outbox/worker, configuration, diagnostics/logging, documentation, and Docker/Compose. CLI and build boundaries were treated as administrative operations rather than public HTTP routes.
- Applied the Express and general frontend references from the security-best-practices skill. Password, recovery, and file-upload recommendations were checked against OWASP.
- This review only read source code and documentation. It did not run tests, builds, lint, dependency audits, applications, containers, or HTTP/SMTP/database probes. It did not extract secrets from local environment or secret files.
- The operational consequences below are inferred from code. Load characteristics, timing differences, and deployed behavior were not measured. Current dependency CVEs were not assessed.

## Critical / High

No findings at these severity levels were established through static analysis.

## Medium

### SBP-001 — Successful uploads can accumulate on disk indefinitely

**Rule ID:** EXPRESS-UPLOAD-001 / EXPRESS-DOS-001. **Confidence:** high that application quotas are absent; actual disk capacity is unknown.

**Location and evidence:**

- [media/routes.ts:10](src/domains/media/routes.ts#L10): the publicly reachable upload route requires a valid JWT; this is not an account quota.
- [media/upload.ts:8](src/domains/media/upload.ts#L8): Multer writes files to disk and bounds an individual upload through fileSize/files/fields/parts.
- [media/service.ts:19](src/domains/media/service.ts#L19): after content validation and conversion, the original remains stored and a MongoDB record is added.
- [media/service.ts:47](src/domains/media/service.ts#L47) and [media/repository.ts:26](src/domains/media/repository.ts#L26): replacing an avatar detaches the previous record while retaining the record and files.
- [media/model.ts:30](src/domains/media/model.ts#L30): an owner/attachment index exists, but unused images have no retention state or TTL.
- [auth/service.ts:203](src/domains/auth/service.ts#L203): account files are removed when the profile is deleted. Rejected uploads are also cleaned up, but successful unused uploads remain.

The existing per-request boundary is:

```ts
limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 2 }
```

**Scenario and impact:** an ordinary account repeatedly uploads valid JPEG/PNG files while respecting the IP rate-limit window and keeping the account. Each successful operation adds an original, a WebP conversion, and a record. After the rate-limit window resets, accumulation can continue. Exhausting a shared upload volume may disrupt uploads for all users and increase storage/backup costs. Uploads do not require verified email, but that alone is not treated as a separate authorization bypass.

**Remediation:** introduce per-owner file-count and total-byte quotas, with atomic reservation before writing a file and correct release on failure. Define a retention period for unused uploads and a separate idempotent cleanup process that removes both files and records. MongoDB TTL alone cannot remove filesystem files. Remove active attachments only under an explicit policy.

**Interim mitigation:** use a dedicated bounded filesystem/object-storage quota, monitor free space, and apply a stricter upload limit. The container RAM limit in [compose.production.yml:37](ops/compose.production.yml#L37) does not limit upload-volume size.

**Conditions / false positives:** external storage quotas may bound the impact; their presence was not established here. Individual file and decoded-image sizes are already limited, so this finding concerns accumulation rather than missing validation of individual files. Public serving of safely re-encoded avatars matches the current design.

Reference: [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html#upload-and-download-limits).

### SBP-002 — Distributed requests have no shared account or recipient budget

**Rule ID:** EXPRESS-AUTH-001; OWASP Forgot Password. **Confidence:** high regarding limiter structure; the effectiveness of external protection is unknown.

**Location and evidence:**

- [rateLimit.ts:8](src/app/http/middlewares/rateLimit.ts#L8): the limiters use Redis without a custom keyGenerator, so express-rate-limit uses its IP key. This was also confirmed by reading the installed package, without issuing requests.
- [rateLimit.ts:22](src/app/http/middlewares/rateLimit.ts#L22): only general API/auth counters exist.
- [config/schemas.ts:118](src/app/config/schemas.ts#L118): defaults are 100 API requests and 10 auth requests per IP per 15 minutes.
- [auth/service.ts:50](src/domains/auth/service.ts#L50): signIn checks the password without a separate failure counter for the target account.
- [auth/service.ts:85](src/domains/auth/service.ts#L85): each permitted reset request for an existing account replaces the token and queues another email.
- [auth/repository.ts:12](src/domains/auth/repository.ts#L12): the reset token is upserted by user.
- [users/service.ts:31](src/domains/users/service.ts#L31): every profile update queues an email, including repeated submissions of identical names; this operation has only the global API limit.

**Scenario and impact:** different IPs receive independent attempt budgets for the same account or recipient. This permits distributed guessing of weak passwords, repeated email enqueueing, and consumption of email quotas. Repeated reset requests also invalidate earlier links before use. A continuous request stream may therefore impede account recovery. This is not unlimited access from one IP: existing Redis limits substantially reduce that risk.

**Remediation:** retain IP limits and add independent budgets by account and operation purpose. For email, add a cooldown and daily recipient/purpose budget, checked atomically before replacing a token and enqueueing a message. Do not queue profile-change notifications when no actual change occurred. Derive email-related keys from normalized identities using HMAC, without exposing addresses in operational keys. A request rejected because of a cooldown must not invalidate an already issued link.

For sign-in, track failures and account/IP combinations. Avoid indefinite account lockouts that an outsider could trigger. Apply the same reset-response policy to existing and absent addresses to avoid introducing another account-enumeration channel.

**Interim mitigation:** external anti-bot rules, provider email limits, and alerts on queue growth. A per-replica SMTP budget does not replace recipient limits in producers.

**Conditions / false positives:** fail-closed Redis limits and explicit trusted-proxy configuration were reviewed; this report does not claim an IP-spoofing bypass in the normal configuration. Separate centralized external protection may compensate for part of the risk. Encrypted outbox payloads and cancellation of obsolete jobs protect content/correctness but do not impose a budget on new requests or emails already sent.

References: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#forgot-password-request), [OWASP Authentication: Login Throttling](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling).

### SBP-003 — The new-password policy permits excessively short passwords

**Rule ID:** OWASP Authentication / password strength; an additional check related to EXPRESS-AUTH-001. **Confidence:** high.

**Location and evidence:** [auth/schemas.ts:5](src/domains/auth/schemas.ts#L5), [auth/schemas.ts:18](src/domains/auth/schemas.ts#L18), [auth/schemas.ts:21](src/domains/auth/schemas.ts#L21), [auth/schemas.ts:22](src/domains/auth/schemas.ts#L22).

```ts
export const passwordSchema = z.string().min(6).max(48)
```

This schema applies to registration, password reset, and password changes. A value such as `123456` passes the visible constraints. The current authentication flow has neither a common/compromised-password check nor a second factor.

**Impact:** users who choose these passwords require few successful guesses for dictionary attacks or credential stuffing. bcrypt with the configured work factor protects password hashing but does not make a weak password strong. Existing IP limits reduce the risk; the distributed scenario is described in SBP-002.

**Remediation:** for new passwords in the current single-factor model, adopt a 15-character minimum and check common/compromised values. Allow longer passphrases. If retaining bcrypt, continue explicitly rejecting values exceeding 72 UTF-8 bytes and document that boundary; do not truncate passwords. Plan support for longer Unicode passwords together with a versioned migration of the storage algorithm.

Do not apply the new minimum to current-password verification during sign-in or confirmation of existing operations: that would deny access to existing users. Update OpenAPI, examples, and client errors alongside the registration/reset/change policy.

**Interim mitigation:** reject common passwords when setting a new password and strengthen throttling. Do not substitute mandatory uppercase/symbol composition rules for length and a blocklist.

**Conditions / false positives:** if the six-character minimum is deliberately retained for product compatibility, record it as an accepted risk policy. Documentation of the current behavior is not itself a compensating control. This is a policy finding, not evidence that a particular account was compromised.

Reference: [OWASP Authentication: Password Strength](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#implement-proper-password-strength-controls).

## Low

### SBP-004 — The API reveals whether an email address is registered

**Rule ID:** OWASP Authentication Responses / Forgot Password. **Confidence:** high regarding different registration responses; timing effects are inferred statically and were not measured.

**Location and evidence:**

- [auth/service.ts:60](src/domains/auth/service.ts#L60): an existing email produces 409 and users.email_taken on guest-accessible registration.
- [auth/service.ts:50](src/domains/auth/service.ts#L50): an absent account ends signIn before bcrypt.compare; an existing account with a wrong password performs the comparison.
- [auth/service.ts:89](src/domains/auth/service.ts#L89): reset returns immediately for an absent account; an existing account triggers a transaction, token replacement, and enqueueing.
- [auth/controller.ts:32](src/domains/auth/controller.ts#L32): the reset response text is already identical, which is a useful control, but execution paths differ.

**Impact:** an unauthenticated client can test whether addresses belong to the service, primarily through the explicit registration response. This assists targeted phishing and guessing if service membership is sensitive. Timing differences are an additional possible channel, not a separately measured vulnerability.

**Remediation:** if the product requires membership privacy, unify the public registration contract and explicitly describe confirmation through the email channel. During sign-in, compare against a prepared dummy bcrypt hash when the account does not exist. For reset, consider aligned execution paths/asynchronous processing and the shared budget from SBP-002. Unifying only messageKey without status and execution paths is insufficient.

**Interim mitigation:** retain IP limits and add attempt budgets/anti-bot protection. Do not treat random delays as complete protection against statistical comparison.

**Conditions / false positives:** a public “email already taken” response may be a deliberate UX tradeoff. In that case, accept and document it rather than changing the current contract without a product-owner decision. This finding does not claim password disclosure or account takeover.

References: [OWASP Authentication Responses](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-responses), [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#forgot-password-request).

## Reviewed boundaries not reported as vulnerabilities

- Authentication uses Bearer tokens rather than an automatically submitted auth cookie. The absence of CSRF middleware is therefore not reported as a vulnerability. Legacy GET sign-out alone does not establish browser CSRF.
- The verified field is stored and returned to clients, while isAuth checks a current account/JWT. No reviewed privileged business operation was established to promise verified-email-only access while omitting that check.
- MongoDB filters use validated scalar fields, and profile updates use an explicit field allowlist. No NoSQL injection or mass-assignment vulnerability was established.
- Email templates and paths come from a trusted server registry. HTTP exposes a catalog, not EJS-code uploads or arbitrary HTML email submission. Standard templates escape translations and variables; raw includes refer to trusted server markup. Configurable EJS files remain executable application code.
- Nodemailer disables file/URL access; recipients and rendered results are validated; SMTP messages/tokens are not logged. Action-link URLs come from configuration rather than the request Host header.
- Swagger is disabled by default; enabled production documentation requires separate credentials. Assets are local, script-src is restricted to self, Bearer persistence is disabled, and query configuration is disabled. The initializer does not load arbitrary external specifications from a URL.
- Production Compose uses a non-root process, a read-only root filesystem, dropped capabilities, file-based secrets, and loopback-only API publishing. Actual reverse-proxy configuration, database/Redis ACLs, TLS, and backups remain deployment properties. The absence of runtime verification of these controls is not presented as a code vulnerability.

## Recommended remediation order

1. SBP-001: file quotas and lifecycle management with atomic accounting.
2. SBP-002: independent account/recipient budgets and cooldowns before invalidating links.
3. SBP-003: a policy for new passwords only, aligned with the client and OpenAPI.
4. SBP-004: decide the registration-privacy policy, then align the contract and execution paths.

No source-code fixes were performed as part of this report. Changes to authentication contracts, password policy, and file storage require a separately agreed implementation stage.
