const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { env } = require('./env');

const adapter = new PrismaMariaDb({
  host: env.dbHost || 'localhost',
  port: parseInt(env.dbPort || '3306', 10),
  user: env.dbUser || 'root',
  password: env.dbPassword,
  database: env.dbName || 'task_management'
});

const prisma = new PrismaClient({ adapter });

// Polyfill BigInt for JSON.stringify to prevent serialization errors
BigInt.prototype.toJSON = function() {
  return this.toString();
};

module.exports = { prisma };
