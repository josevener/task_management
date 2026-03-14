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

module.exports = { pool, query, withTransaction };
