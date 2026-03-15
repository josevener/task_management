'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  await db.runSql(`
    ALTER TABLE organizations
    ADD COLUMN owner_id INT NULL,
    ADD CONSTRAINT fk_org_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
  `);

  // Populate owner_id for existing organizations
  // We'll pick the first admin member from any workspace in the organization
  await db.runSql(`
    UPDATE organizations o
    SET o.owner_id = (
      SELECT wm.user_id
      FROM workspace_members wm
      INNER JOIN workspaces w ON w.id = wm.workspace_id
      WHERE w.organization_id = o.id AND wm.role = 'admin'
      LIMIT 1
    )
    WHERE o.owner_id IS NULL;
  `);
};

exports.down = async function (db) {
  await db.runSql(`
    ALTER TABLE organizations
    DROP FOREIGN KEY fk_org_owner,
    DROP COLUMN owner_id;
  `);
};

exports._meta = {
  "version": 1
};
