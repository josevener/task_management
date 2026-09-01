const DEFAULT_MAX_ATTEMPTS = 3;

async function runSerializableTransaction(prisma, operation, maxAttempts = DEFAULT_MAX_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      // Serializable isolation makes hierarchy reads conflict with concurrent parent rewrites.
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    }
    catch (error) {
      const shouldRetry = error?.code === 'P2034' && attempt < maxAttempts;
      if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw new Error('Serializable transaction retry limit exceeded');
}

module.exports = { DEFAULT_MAX_ATTEMPTS, runSerializableTransaction };
