const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { prepareExistingPrismaDb } = require('../prisma/prepare-existing-prisma-db');
const {
  createLegacyAppSchema,
  createPrismaForTestDatabase,
  insertLegacyUser,
  withAuthRouter,
  withMariaDbTestDatabase,
} = require('./mariadb-integration-utils');

test('prepared legacy schema supports OTP resend/verify and password reset auth flows', async (t) => {
  await withMariaDbTestDatabase(t, async ({ connection, dbConfig }) => {
    await createLegacyAppSchema(connection);

    const userEmail = 'legacy.auth@example.com';
    await insertLegacyUser(connection, {
      email: userEmail,
      firstName: 'Legacy',
      lastName: 'Auth',
      isActive: false,
      emailVerifiedAt: null,
    });

    await prepareExistingPrismaDb(dbConfig);

    const prisma = createPrismaForTestDatabase(dbConfig);

    try {
      await withAuthRouter(prisma, async (requestJson) => {
        const resendResponse = await requestJson('/resend-otp', {
          method: 'POST',
          body: { email: userEmail },
        });

        assert.equal(resendResponse.status, 200);
        assert.equal(resendResponse.body.data.message, 'New verification code sent successfully.');

        const otpRecord = await prisma.emailOtpVerification.findFirst({
          where: { email: userEmail },
          orderBy: { createdAt: 'desc' },
        });

        assert.ok(otpRecord);
        assert.match(otpRecord.otpCode, /^\d{6}$/);

        const verifyResponse = await requestJson('/verify-otp', {
          method: 'POST',
          body: {
            email: userEmail,
            otp_code: otpRecord.otpCode,
          },
        });

        assert.equal(verifyResponse.status, 200);
        assert.equal(
          verifyResponse.body.data.message,
          'Email verified successfully. Your workspace has been set up.'
        );

        const activeUser = await prisma.user.findUnique({
          where: { email: userEmail },
        });

        assert.equal(activeUser.isActive, true);
        assert.ok(activeUser.emailVerifiedAt);

        const workspaceMembershipCount = await prisma.workspaceMember.count({
          where: { userId: activeUser.id },
        });

        assert.equal(workspaceMembershipCount, 1);

        const forgotPasswordResponse = await requestJson('/forgot-password', {
          method: 'POST',
          body: { email: userEmail },
        });

        assert.equal(forgotPasswordResponse.status, 200);
        assert.equal(
          forgotPasswordResponse.body.data.message,
          'If that email exists, a reset link has been sent.'
        );

        const resetRecord = await prisma.passwordReset.findFirst({
          where: { email: userEmail },
          orderBy: { createdAt: 'desc' },
        });

        assert.ok(resetRecord);
        assert.ok(resetRecord.token);

        const resetPasswordResponse = await requestJson('/reset-password', {
          method: 'POST',
          body: {
            token: resetRecord.token,
            password: 'new-legacy-pass-456',
          },
        });

        assert.equal(resetPasswordResponse.status, 200);
        assert.equal(resetPasswordResponse.body.data.message, 'Password has been successfully reset.');

        const updatedUser = await prisma.user.findUnique({
          where: { email: userEmail },
        });

        assert.equal(await bcrypt.compare('new-legacy-pass-456', updatedUser.passwordHash), true);

        const remainingResetCount = await prisma.passwordReset.count({
          where: { email: userEmail },
        });

        assert.equal(remainingResetCount, 0);
      });
    }
    finally {
      await prisma.$disconnect();
    }
  });
});
