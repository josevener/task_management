exports.up = async function up(db) {
  await db.runSql(`ALTER TABLE tasks ADD COLUMN assigned_by INT NULL AFTER assignee_id;`);
  await db.runSql(`ALTER TABLE tasks ADD CONSTRAINT fk_tasks_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;`);
  await db.runSql(`ALTER TABLE tasks ADD INDEX idx_assigned_by (assigned_by);`);
};

exports.down = async function down(db) {
  await db.runSql(`ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_assigned_by;`);
  await db.runSql(`ALTER TABLE tasks DROP INDEX idx_assigned_by;`);
  await db.runSql(`ALTER TABLE tasks DROP COLUMN assigned_by;`);
};
