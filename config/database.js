const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { env } = require('./env');
const { withPublicId } = require('../utils/public-id');

const adapter = new PrismaMariaDb({
  host: env.dbHost || 'localhost',
  port: parseInt(env.dbPort || '3306', 10),
  user: env.dbUser || 'root',
  password: env.dbPassword,
  database: env.dbName || 'task_management'
});

const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (operation === 'create') {
          args.data = withPublicId(model, args.data);
        } else if (operation === 'createMany') {
          args.data = Array.isArray(args.data)
            ? args.data.map((data) => withPublicId(model, data))
            : withPublicId(model, args.data);
        } else if (operation === 'upsert') {
          args.create = withPublicId(model, args.create);
        }

        return query(args);
      }
    }
  }
});

// Polyfill BigInt for JSON.stringify to prevent serialization errors
BigInt.prototype.toJSON = function() {
  return this.toString();
};

module.exports = { prisma };
