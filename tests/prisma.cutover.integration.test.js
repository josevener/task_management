const test = require('node:test');
const assert = require('node:assert/strict');

const { prepareExistingPrismaDb } = require('../prisma/prepare-existing-prisma-db');
const {
  createLegacyAppSchema,
  withMariaDbTestDatabase,
} = require('./mariadb-integration-utils');

test('existing-db Prisma cutover prepares missing auth tables in a real MariaDB schema', async (t) => {
  await withMariaDbTestDatabase(t, async ({ connection, dbConfig, databaseName }) => {
    await createLegacyAppSchema(connection);

    const beforeTables = await connection.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_name IN ('email_otp_verifications', 'password_resets')
        ORDER BY table_name ASC
      `,
      [databaseName]
    );

    assert.deepEqual(beforeTables.map((row) => row.table_name), []);

    await prepareExistingPrismaDb(dbConfig);
    await prepareExistingPrismaDb(dbConfig);

    const afterTables = await connection.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_name IN ('email_otp_verifications', 'password_resets')
        ORDER BY table_name ASC
      `,
      [databaseName]
    );

    assert.deepEqual(
      afterTables.map((row) => row.table_name),
      ['email_otp_verifications', 'password_resets']
    );
  });
});
