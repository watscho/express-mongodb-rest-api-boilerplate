# Deployment secrets

Secret values are deliberately not supplied. Create or mount these files through your deployment's secret-management process:

- `api-mongodb-uri`: replica-set/Atlas URI for the API database user.
- `worker-mongodb-uri`: URI for the worker's database user.
- `maintenance-mongodb-uri`: URI for an operator allowed to create collections/indexes and perform planned maintenance.
- `redis-uri`: authenticated Redis connection URL used only by the API.
- `jwt-secret`: persistent random secret of at least 32 characters, used only by the API.
- `mail-queue-key`: persistent 32-byte random key encoded as 64 hex characters; shared by API and workers.
- `smtp-password`: SMTP credential used only by the worker.

All URIs must select the same application database where appropriate. Give each MongoDB identity only its required collection privileges; ordinary API/worker startup does not create collections or indexes when automatic indexing is disabled. See [deployment instructions](../../docs/deployment.md).

These files are excluded from Git and the Docker build context. Ensure container UID/GID 1000 can read mounted files without granting unnecessary host access. Local Compose file-backed secrets may preserve host ownership/permissions rather than honoring secret uid/gid settings. A dedicated production secret manager is preferable to copying secrets into images or committed environment files.

`*_FILE` values are read at process startup. Setting a nonempty plain value and its `_FILE` counterpart together is rejected. Changes require restarting the affected processes; queue-key rotation also requires a data migration/drain plan.
