# MongoDB models and indexes

This document maps model declarations to the application's actual filters, sorts, and invariants. It records source-level choices, not measured query plans: no database connection, explain, benchmark, migration, or index operation was run.

MongoDB must support transactions. Ordinary connections request majority acknowledgement; account workflows use primary/snapshot transactions. Mongoose command buffering is disabled, and pool/connection/wait limits are explicit. Automatic model collection/index initialization is disabled by default; run planned maintenance before traffic.

## Query and index map

Every collection keeps MongoDB's built-in unique `_id` index.

| Collection / model                 | Index                                                        | Query / constraint                                                        |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `users` / `User`                   | Unique `email`                                               | Normalized sign-in/account lookup; duplicate-address protection           |
| `resetpasswords` / `ResetPassword` | Unique `tokenHash`                                           | Atomic single-use consume plus explicit expiry predicate                  |
| `resetpasswords`                   | Unique `user` (`reset_one_token_per_user`)                   | At most one reset token per account; replacement and invalidation by user |
| `resetpasswords`                   | TTL `expiresIn`, expiry 0                                    | Asynchronous cleanup; not the authority for token validity                |
| `verifications` / `Verification`   | Unique `tokenHash`                                           | Atomic consume; email match remains a business rule                       |
| `verifications`                    | Unique `user` (`verification_one_token_per_user`)            | At most one verification token per account                                |
| `verifications`                    | TTL `expiresIn`, expiry 0                                    | Expired-token cleanup                                                     |
| `Media` (default collection)       | `owner, refType, refId` (`media_owner_attachment`)           | Owner-prefix file reads/deletion and full attachment lookup/detachment    |
| `email_outbox`                     | `status, availableAt, _id`                                   | Due queued jobs, sorted by availability with a stable tie-breaker         |
| `email_outbox`                     | `status, lockedUntil, _id` (`outbox_expired_leases`)         | Recovery of expired processing leases, sorted by lease expiry             |
| `email_outbox`                     | `status, createdAt DESC, _id DESC` (`outbox_status_created`) | Status-filtered cursor pagination; reverse scan for oldest queued age     |
| `email_outbox`                     | `ownerId, purpose, status`                                   | Cancellation of account/security-link jobs                                |
| `email_outbox`                     | TTL `purgeAt`, expiry 0                                      | Bounded cleanup of terminal records and abandoned expired input           |
| `email_workers` / `EmailWorker`    | `status, lastSeenAt DESC`                                    | Fresh running-worker lookup                                               |
| `email_workers`                    | `lastSeenAt DESC`                                            | Bounded recent-worker metadata listing                                    |
| `email_workers`                    | TTL `expiresAt`, expiry 0                                    | Cleanup of old heartbeat records                                          |

Unique hash lookup already identifies at most one token; adding `expiresIn` to that index would add write/storage cost without reducing the candidate set. `_id` already bounds lookups combined with owner/version/lease predicates, so duplicate `_id + owner/version` indexes are not added.

Queue claiming uses separate atomic queries for expired leases and queued work, each with its matching sort/index. This avoids asking one OR query to sort both different access patterns. Recovered work has priority; separate email jobs still have no inbox-order guarantee.

Avatar replacement is serialized by the user's mutation counter in the same transaction as detaching/attaching media. The owner/attachment index optimizes those filters, but it does not enforce a cross-document single-avatar invariant against arbitrary external writes. This avoids making replacement depend on transferring a unique key between different media documents inside one transaction. Administrative writers must preserve the same invariant; the index command rejects pre-existing duplicate attached avatars before proceeding.

## Data and read-path choices

- Account email is trimmed, lowercase, bounded, and unique; provider-specific alias rewriting is deliberately absent.
- Stored passwords must have the bcrypt hash shape/length and remain excluded from ordinary queries.
- Account counters and file sizes have nonnegative integer constraints. MongoDB updates/unique indexes and transaction locks enforce the workflow; Mongoose validation is not a substitute for server-side security against arbitrary privileged writes.
- Token hashes have the SHA-256 hexadecimal shape; verification email metadata is normalized/bounded.
- Reset/verification issuance replaces the user's token in place with an upsert under the account's transaction lock. This avoids delete/reinsert of the same newly unique user value and invalidates the previous digest atomically.
- Account/credential reads and returned update snapshots use `lean()` plus explicit field projections. DTO transformers require plain field snapshots rather than hydrated document methods.
- The user repository converts its persistence snapshots into account/credential DTOs before returning them. Its public service facade uses direct function references; callers receive promises of domain values, not Mongoose queries or native command results.
- Avatar/file reads use lean projected metadata. Existence-only ownership checks select `_id` instead of the full image record.
- Outbox ciphertext and fingerprints are excluded by default. Only producer idempotency reads select fingerprints, and worker claims/attempts select ciphertext. Operational DTOs omit both and do not decrypt.
- Queue lists are bounded to 100 rows with a cursor over `(createdAt, _id)`; they avoid growing `skip` offsets. Statistics queries have server-side deadlines.

Lean results bypass document getters, virtuals, and change tracking. These read paths rely on explicit field DTOs, so they do not need hydration. Create/save paths still use Mongoose documents. See [Mongoose lean](https://mongoosejs.com/docs/tutorials/lean.html).

## Explicit index maintenance

```sh
yarn db:indexes
# From a compiled production artifact:
yarn db:indexes:prod
```

The command forces automatic DDL off, looks for duplicate email/token-owner/token-hash/attached-avatar-owner groups, and stops before collection/index creation if conflicts are found. Diagnostic logs identify the stage/model/field without revealing grouped emails or tokens. After preflight, it creates missing collections and declared indexes. Existing operator-managed indexes are not dropped or synchronized away.

Stop API and worker writers before maintenance, back up the database/filesystem, and resolve legacy data according to the migration guide. Preflight cannot eliminate races if other writers remain active. Index creation is not one atomic multi-collection operation: a later failure may leave earlier indexes installed, and rerunning is expected after repair.

Duplicate token owners require an explicit policy: retain the intended latest valid link or revoke affected links and ask users to request new ones. Duplicate avatars require choosing the intended current avatar; preserve other owned images as unattached records. The index script does not guess, delete accounts, discard media, or revoke links on your behalf.

## Existing index reconciliation

New deployments create only the current declarations. Existing deployments may retain obsolete indexes because `createIndexes` is additive:

- Old nonunique `user_1` token indexes may be redundant once the named unique user index is present.
- Old standalone `owner_1` and `refType_1_refId_1` media indexes are superseded in current declarations by the owner/attachment compound index.
- The old two-field `status_1_lockedUntil_1` index may be superseded by the lease-recovery index with `_id`.

Review actual server index definitions/workloads before removing any of them in a separate maintenance change. This implementation neither calls `syncIndexes` nor drops/changes existing indexes automatically. Matching key patterns with different unique/partial options need explicit names and a compatible MongoDB version (the project requires 8.x).

TTL cleanup is asynchronous. Authentication queries enforce `expiresIn > now`, and the worker enforces job expiry before SMTP; correctness does not wait for TTL deletion. Worker health uses freshness, not TTL deletion, to detect stale workers.

## Operational scope

Pool sizes apply per process. MongoDB credentials for the API, worker, and maintenance should be separate; only maintenance needs index-management privileges. Backups must include account/token/media metadata, outbox/worker state as appropriate, persistent files, and separately managed encryption-key recovery. Never restore a database without considering corresponding queued email side effects.

Follow [restore and rollback](operations.md#restore-and-rollback) for the coordinated order and session/delivery implications. Declared indexes are source requirements; the dated [validation status](../README.md#validation-status) does not claim they have been applied to a server.

The selected indexes follow [MongoDB equality/sort/range guidance](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/). No speedup or query-plan qualification is claimed without representative data and explicitly authorized runtime work.
