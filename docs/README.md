# Documentation

Start with the guide for your task. The root [README](../README.md) provides installation, a short API walkthrough, commands, and the current [validation status](../README.md#validation-status).

## Reading paths

| Task                              | Read in this order                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Run a new installation            | [Quick start](../README.md#quick-start) → [Configuration](configuration.md) → [Database](database.md)                                  |
| Connect a frontend/client         | [Client integration](client-integration.md) → [API message keys](api-message-keys.md) → [OpenAPI/Swagger](openapi.md)                  |
| Add a domain or endpoint          | [Architecture](architecture.md) → [Developer guide](development.md) → [QA/handoff](handoff.md)                                         |
| Customize email                   | [Notifications](notifications.md) → [Template catalog](../src/domains/notifications/templates/README.md) → [Operations](operations.md) |
| Upgrade a 1.x installation        | [Migration](migration.md) → [Database](database.md) → [Deployment](deployment.md)                                                      |
| Deploy or investigate an incident | [Deployment](deployment.md) → [Operations](operations.md) → [Configuration](configuration.md)                                          |

## Guide ownership

For Yarn installation, lockfiles, CI setup, or package-manager warnings, use [tooling](tooling.md).

For configuration, connection, startup, or console errors, start with [runtime diagnostics](logging.md), then consult [configuration](configuration.md) and [operations](operations.md).

| Guide                                       | Owns                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Architecture](architecture.md)             | Domain/process ownership, optional transformers, data and transaction boundaries                  |
| [Developer guide](development.md)           | Illustrative domain implementation, registration, middleware, extension patterns                  |
| [Client integration](client-integration.md) | Current route/payload map, JWT lifecycle, email-link handling, uploads, browser integration       |
| [API message keys](api-message-keys.md)     | Response envelopes, client translation, field errors                                              |
| [OpenAPI/Swagger](openapi.md)               | Documentation access, export, schema/reference maintenance                                        |
| [Configuration](configuration.md)           | Validated settings, process profiles, secret loading                                              |
| [Database](database.md)                     | Actual model/index declarations, constraints, maintenance                                         |
| [Notifications](notifications.md)           | Registration, variables, locale selection, rendering, queue semantics                             |
| [Operations](operations.md)                 | CLI output/exit codes, job/worker diagnosis, incident and restore procedures                      |
| [Runtime diagnostics](logging.md)           | Bootstrap/configuration failures, console/JSON streams, safe stack context, diagnostic categories |
| [Deployment](deployment.md)                 | Container artifact, service identities, topology, rollout and rollback                            |
| [Migration](migration.md)                   | Breaking changes and ordered 1.x → 2.0 transition                                                 |
| [QA/handoff](handoff.md)                    | Acceptance scenarios, evidence, feature/release transfer                                          |
| [Changelog](../CHANGELOG.md)                | Versioned changes                                                                                 |

## Examples and evidence

See [utility ownership](architecture.md#utilities-and-ownership) when deciding whether code belongs in a local helper, a named domain adapter, or an application-owned path/documentation module.

The `notes` domain in the developer guide is illustrative and is not registered in the application. The client integration map describes the shipped routes. Commands and acceptance scenarios are instructions, not a record of their execution.

Local typecheck/build/lint/format results do not establish runtime, database, container, or SMTP acceptance. Use the README's dated validation status and a feature-specific [handoff record](handoff.md#record-results) to distinguish completed checks from planned work.

## Keep documentation aligned with code

| Change                            | Update together                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Endpoint/path/auth/status/payload | Domain schemas/DTOs/controller/routes and `documentation.ts`, client integration map, client keys       |
| Domain registration               | Root HTTP router, OpenAPI assembly, developer/architecture guidance, ESLint boundaries                  |
| Model/index/account ownership     | Index command and conflict preflights, database guide, migration/retention policy                       |
| Configuration or secret           | Owning schema/profile/DTO, environment examples, configuration guide, relevant deployment secret mounts |
| Template/variables/locale         | Registry, template files/dictionaries/catalog, producer and worker compatibility notes                  |
| CLI/script/worker behavior        | `package.json`, operations/deployment commands, exit codes and recovery instructions                    |
| Release acceptance                | Dated validation/handoff evidence and changelog; retain explicit unperformed work                       |

Check local links and section anchors after moving files or renaming headings. Format changed Markdown with Prettier. Review command examples against `package.json` and their implementation; avoid executing migrations, retries, API calls, or deployments merely to review documentation.
