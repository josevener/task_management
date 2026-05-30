const mysql = require('mysql2/promise');
const { env } = require('./env');

// A shared pool keeps route handlers simple and avoids reconnect churn.
const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  connectionLimit: 10,
  namedPlaceholders: false,
});

// Polyfill BigInt for JSON.stringify to prevent serialization errors
BigInt.prototype.toJSON = function() {
  return this.toString();
};

const existingColumnCache = new Map();

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function withTransaction(callback) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  }
  catch (error) {
    await connection.rollback();
    throw error;
  }
  finally {
    connection.release();
  }
}

async function getExistingColumns(tableName, columnNames = []) {
  if (!tableName || columnNames.length === 0) {
    return new Set();
  }

  const cacheKey = `${tableName}:${columnNames.slice().sort().join(',')}`;
  if (existingColumnCache.has(cacheKey)) {
    return existingColumnCache.get(cacheKey);
  }

  const placeholders = columnNames.map(() => '?').join(', ');
  const rows = await query(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME IN (${placeholders})
    `,
    [tableName, ...columnNames]
  );

  const existingColumns = new Set(rows.map((row) => row.COLUMN_NAME));
  existingColumnCache.set(cacheKey, existingColumns);
  return existingColumns;
}

module.exports = { pool, query, withTransaction, getExistingColumns };
