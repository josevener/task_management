'use strict';

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  await db.runSql(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS default_language VARCHAR(20) NULL,
      ADD COLUMN IF NOT EXISTS date_format VARCHAR(30) NULL,
      ADD COLUMN IF NOT EXISTS time_format VARCHAR(30) NULL,
      ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) NOT NULL DEFAULT 'active';
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    ALTER TABLE organizations
      DROP COLUMN IF EXISTS subscription_status,
      DROP COLUMN IF EXISTS time_format,
      DROP COLUMN IF EXISTS date_format,
      DROP COLUMN IF EXISTS default_language,
      DROP COLUMN IF EXISTS timezone;
  `);
};

exports._meta = {
  version: 1
};
