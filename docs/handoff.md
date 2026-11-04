# Developer, QA, and release handoff

Use this guide when transferring a feature to another developer, QA, or an operator. It describes the API, environment, scenarios, and evidence the recipient needs. The repository includes colocated unit tests; it has no separate QA service.

This document defines a handoff process and suggested manual scenarios. It does not record those scenarios as executed. The current local tooling results are summarized in the [README](../README.md#validation-status); environment acceptance requires its own evidence.

## What to deliver

| Item            | Required information                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| Scope           | Feature behavior, affected domains/routes, intentional exclusions                          |
| Code reference  | Exact commit/artifact identifier, entrypoints, reviewable changes                          |
| API contract    | Swagger operations, request/response examples, status/message keys, client changes         |
| Access rules    | Anonymous/authenticated/verified roles, ownership, account lifecycle implications          |
| Environment     | Node/package versions, process roles, required settings, secret names without values       |
| Data changes    | Collections/indexes, migration order, duplicate handling, backup and rollback implications |
| Background work | Worker/template changes, delivery receipt semantics, retry/expiry/cancellation behavior    |
| Evidence        | Command/scenario, environment, date, result, and safe supporting artifact                  |
| Open items      | Known limitations, failures, unperformed checks, owner and next action                     |

Do not include real credentials, bearer/email tokens, recipient content, or production records in handoff documents. Provide a protected test account through the team's established secret-sharing process when one is needed.

## Local developer checks

The available tooling commands are:

```sh
yarn test
yarn typecheck
yarn lint
yarn format:check
yarn build
```

These check types, lint, formatting, and compilation/assets; they do not establish HTTP behavior, database migrations, browser rendering, SMTP delivery, or operational readiness. Record the artifact and actual exit results. Do not report `Passed` for a command that was only suggested or documented. Recheck affected areas after a change when authorized and necessary.

`yarn test` builds and runs the unit suite without external services. Tests live in `__tests__` beside their owning modules. `yarn test:coverage` instruments all application modules and enforces 100% statements, branches, functions, and lines, including initially unloaded modules. Unit tests do not establish database transaction behavior or external-provider acceptance. See [testing](testing.md).

## Prepare a manual acceptance environment

1. Use an isolated non-production database/Redis namespace and test-only accounts/data.
2. Provision the required MongoDB replica set, collections/indexes, SMTP sandbox, and API/worker processes using [configuration](configuration.md) and [deployment](deployment.md).
3. Confirm which artifact/configuration each process runs. Keep template registrations and queue keys compatible across producers/workers.
4. Agree on the scenarios and permitted state changes before execution, including account deletion, migration/index operations, and email retries.
5. Capture safe request IDs, job IDs, status codes, message keys, and timestamps. Remove tokens and personal data from screenshots/log extracts.

Swagger's **Try it out** is off by default. When enabled in a suitable environment, it invokes real operations; it is not a mock. Documentation HTTP Basic credentials differ from the bearer JWT used for application calls.

## Suggested manual scenarios

Use only the scenarios relevant to the change, with a stated expected result. The example `notes` routes below exist only after implementing the [developer guide](development.md).

| Area               | Scenario                                                             | Expected outcome                                                                     |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Startup            | Required configuration or dependency unavailable                     | Bounded startup failure with safe diagnostic context; no successful readiness claim  |
| Authentication     | Protected route without a bearer token                               | `401` with a machine message key                                                     |
| Authentication     | Invalid/expired/revoked/superseded JWT                               | `401`; no protected mutation                                                         |
| Guest flow         | Sign-in/sign-up with an already authenticated request                | `403`; omit Authorization for an anonymous request                                   |
| Domain policy      | Unverified account creates a note in the example                     | `403`, `notes.verification_required`; no note created                                |
| Validation         | Missing/malformed/out-of-bounds fields                               | `400`, `validation.failed`, field details without rejected values                    |
| Ownership          | Account B reads account A's note in the example                      | `404`, `notes.not_found`, matching an absent note                                    |
| Happy path         | Verified account creates/reads its own example note                  | `200`, documented DTO and `notes.created` / `notes.loaded`                           |
| Contract           | Compare route and Swagger request/response                           | Method, path, authentication, status, fields, and keys agree                         |
| Client translation | Change UI language on the same API operation                         | API keys remain machine keys; client supplies displayed text                         |
| Email language     | Supported regional/weighted Accept-Language, then unsupported locale | Queued email follows supported preference/fallback; API keys unchanged               |
| Transaction        | Business write or enqueue fails                                      | Transactional business/job changes roll back together; no orphan committed email job |
| Worker             | Worker unavailable, then restored before expiry                      | Jobs remain queued, then are claimed subject to lease/budget/deadline policy         |
| Email failures     | Temporary failure versus permanent/configuration failure             | Bounded retries versus terminal safe error category; no false inbox-delivery claim   |
| Account lifecycle  | Delete an account with domain-owned records                          | Matches the documented retention/deletion policy, including related jobs/files       |
| Rate limit         | Exceed the relevant configured request limit                         | `429` with Retry-After; no bypass of account/ownership rules                         |
| Health             | API dependency loss versus worker/provider loss                      | API readiness and worker/job diagnostics reflect their separate scopes               |

Failure injection, concurrency, restart, retry, or migration scenarios can change state and require a controlled environment and an agreed procedure. A heartbeat alone does not prove SMTP acceptance; SMTP acceptance does not prove inbox delivery. Avoid inferring runtime results from source review or compilation.

## Record results

Use a compact feature-specific record in your issue/release handoff. Replace placeholders with real evidence and keep unperformed work marked explicitly:

```text
Feature / artifact:
Environment / date:
Configuration or migration prerequisites:

Check or scenario | Expected outcome | Actual outcome | Status | Evidence
...               | ...              | ...            | ...    | ...

Known limitations / open items:
Owner / next action:
Rollout and rollback decision:
```

Useful statuses are `Passed`, `Failed`, `Not run`, and `Blocked` with a concrete reason. Link to sanitized evidence rather than pasting secrets or full payloads. A failed or skipped scenario remains open until it is resolved or explicitly accepted by the responsible release owner.

## Release handoff

Give the operator the artifact, migration/index order, role-specific configuration, backups, monitoring signals, and recovery/rollback procedure. Consult [database](database.md), [operations](operations.md), and [deployment](deployment.md). No deployment, index creation, migration, or queue retry occurs merely because a guide describes its command.

Separate **source integrated**, **local tooling passed**, **environment acceptance completed**, and **deployed**. Record each status only when the corresponding work has happened; version `2.0.0` or a successful build does not establish production acceptance.
