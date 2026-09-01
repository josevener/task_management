const test = require('node:test');
const assert = require('node:assert/strict');

const { runSerializableTransaction } = require('../utils/serializable-transaction');

test('serializable transactions retry write conflicts and return the committed result', async () => {
  let attempts = 0;
  const prisma = {
    async $transaction(operation, options) {
      attempts += 1;
      assert.equal(options.isolationLevel, 'Serializable');
      if (attempts < 3) {
        const error = new Error('write conflict');
        error.code = 'P2034';
        throw error;
      }
      return operation({ attempt: attempts });
    }
  };

  const result = await runSerializableTransaction(prisma, async (tx) => tx.attempt);

  assert.equal(result, 3);
  assert.equal(attempts, 3);
});

test('serializable transactions do not retry non-conflict errors', async () => {
  let attempts = 0;
  const expectedError = new Error('validation failed');
  const prisma = {
    async $transaction() {
      attempts += 1;
      throw expectedError;
    }
  };

  await assert.rejects(
    runSerializableTransaction(prisma, async () => undefined),
    (error) => error === expectedError
  );
  assert.equal(attempts, 1);
});
