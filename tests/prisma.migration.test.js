const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

test('prisma migration artifacts include seeded RBAC data and an explicit existing-db cutover path', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const migrationSql = fs.readFileSync(
    path.join(ROOT_DIR, 'prisma', 'migrations', '20260626045553_init', 'migration.sql'),
    'utf8'
  );
  const cutoverDoc = fs.readFileSync(path.join(ROOT_DIR, 'docs', 'prisma-migration-cutover.md'), 'utf8');
  const legacyPrepScript = require(path.join(ROOT_DIR, 'prisma', 'prepare-existing-prisma-db.js'));
  const integrationTest = fs.readFileSync(
    path.join(ROOT_DIR, 'tests', 'prisma.cutover.integration.test.js'),
    'utf8'
  );
  const authIntegrationTest = fs.readFileSync(
    path.join(ROOT_DIR, 'tests', 'auth.cutover.integration.test.js'),
    'utf8'
  );

  assert.equal(packageJson.scripts['db:seed'], 'prisma db seed');
  assert.match(packageJson.scripts['migrate:deploy'], /prisma db seed/);
  assert.equal(
    packageJson.scripts['migrate:prepare-existing'],
    'node prisma/prepare-existing-prisma-db.js'
  );
  assert.equal(
    packageJson.scripts['migrate:baseline-existing'],
    'prisma migrate resolve --applied 20260626045553_init'
  );

  assert.match(migrationSql, /CREATE TABLE `email_otp_verifications`/);
  assert.match(migrationSql, /CREATE TABLE `password_resets`/);
  assert.match(migrationSql, /INSERT INTO `permissions`/);

  assert.equal(legacyPrepScript.LEGACY_PRISMA_COMPATIBILITY_SQL.length, 2);
  assert.match(legacyPrepScript.LEGACY_PRISMA_COMPATIBILITY_SQL[0], /CREATE TABLE IF NOT EXISTS email_otp_verifications/);
  assert.match(legacyPrepScript.LEGACY_PRISMA_COMPATIBILITY_SQL[1], /CREATE TABLE IF NOT EXISTS password_resets/);

  assert.match(cutoverDoc, /migrate:prepare-existing/);
  assert.match(cutoverDoc, /migrate:baseline-existing/);
  assert.match(cutoverDoc, /migrate:deploy/);

  assert.match(integrationTest, /prepareExistingPrismaDb/);
  assert.match(integrationTest, /information_schema\.tables/);
  assert.match(authIntegrationTest, /\/resend-otp/);
  assert.match(authIntegrationTest, /\/reset-password/);
});

test('the persistent session migration remains represented in the Prisma schema', () => {
  const sessionMigrationSql = fs.readFileSync(
    path.join(ROOT_DIR, 'prisma', 'migrations', '20260828000000_add_sessions_table', 'migration.sql'),
    'utf8'
  );
  const prismaSchema = fs.readFileSync(path.join(ROOT_DIR, 'prisma', 'schema.prisma'), 'utf8');

  assert.match(sessionMigrationSql, /CREATE TABLE `sessions`/);
  assert.match(sessionMigrationSql, /INDEX `sessions_expires_at_idx`/);
  assert.match(prismaSchema, /model Session \{/);
  assert.match(prismaSchema, /@@map\("sessions"\)/);
  assert.match(prismaSchema, /@@index\(\[expiresAt\], map: "sessions_expires_at_idx"\)/);
});
