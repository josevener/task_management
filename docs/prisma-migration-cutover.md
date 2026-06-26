## Prisma Cutover

This repository now treats Prisma as the source of truth for schema changes.

### Existing Databases

Existing environments that were created with `db-migrate` must baseline the Prisma `init` migration once before normal deploys:

```bash
npm run migrate:prepare-existing
npm run migrate:baseline-existing
npm run migrate:deploy
```

`migrate:prepare-existing` creates any auth-support tables that were used by the legacy app code but never landed in the checked-in `db-migrate` history.

`migrate:baseline-existing` marks `20260626045553_init` as already applied so Prisma does not try to recreate tables that already exist.

### Fresh Databases

For brand-new databases, run:

```bash
npm run migrate:deploy
```

That applies the Prisma migrations and then runs `prisma db seed` so the RBAC permission catalogue is present before any workspace or account bootstrap flow executes.
