const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { prisma } = require('../config/database');
const { env } = require('../config/env');
const { attachCurrentUser, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/async-handler');
const { sendError, sendSuccess, sendValidationError } = require('../utils/responses');
const { createSlug } = require('../utils/slug');
const { sendMail } = require('../utils/mailer');
const { createRoleWithPermissions } = require('../utils/rbac');

const authRouter = express.Router();

authRouter.use(attachCurrentUser);

async function cleanupPendingRegistration(email) {
  await prisma.$transaction(async (tx) => {
    const pendingUser = await tx.user.findFirst({
      where: {
        email,
        isActive: false,
        emailVerifiedAt: null
      },
      select: { id: true }
    });

    if (!pendingUser) {
      return;
    }

    const membership = await tx.workspaceMember.findFirst({
      where: { userId: pendingUser.id },
      select: { id: true }
    });

    if (membership) {
      return;
    }

    await tx.emailVerificationToken.deleteMany({
      where: { email }
    });

    await tx.user.delete({
      where: { id: pendingUser.id }
    });
  });
}

authRouter.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const user = await prisma.user.findFirst({
    where: { email }
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return sendError(res, 'Invalid email or password', 401);
  }

  if (!user.isActive) {
    return sendError(res, 'Your email address is not verified. Please check your email for the verification code.', 403, {
      needs_verification: true,
      email: user.email
    });
  }

  req.session.user_id = user.id;
  req.session.user_email = user.email;

  return sendSuccess(res, {
    user: {
      id: user.publicId,
      public_id: user.publicId,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt,
    },
    message: 'Login successful',
  });
}));

authRouter.post('/register', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const first_name = String(req.body.first_name || '').trim();
  const last_name = String(req.body.last_name || '').trim();
  const errors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email format';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters long';
  }

  if (!first_name) {
    errors.first_name = 'First name is required';
  }

  if (!last_name) {
    errors.last_name = 'Last name is required';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true }
  });

  if (existing) {
    return sendValidationError(res, { email: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        email,
        passwordHash: password_hash,
        firstName: first_name,
        lastName: last_name,
        isActive: false
      }
    });

    await tx.emailVerificationToken.create({
      data: {
        email,
        token,
        expiresAt
      }
    });
  });

  const verifyLink = `${env.appOrigin}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f766e;">Welcome to Zentrix!</h2>
      <p>Hi ${first_name},</p>
      <p>Thank you for signing up. Please click the button below to verify your email address and activate your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyLink}" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #64748b; font-size: 14px;">${verifyLink}</p>
      <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">This link will expire in 24 hours. If you did not request this, please ignore this email.</p>
    </div>
  `;

  try {
    await sendMail({
      to: email,
      subject: 'Zentrix - Verify Your Email',
      html: htmlContent,
    });
  } catch (error) {
    await cleanupPendingRegistration(email);
    throw error;
  }

  return sendSuccess(res, {
    message: 'Registration successful. Please check your email for the verification link.',
    email,
  }, 201);
}));

authRouter.post('/verify-token', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const token = String(req.body.token || '').trim();

  if (!email || !token) {
    return sendValidationError(res, {
      email: !email ? 'Email is required' : undefined,
      token: !token ? 'Verification token is required' : undefined
    });
  }

  const tokenRecord = await prisma.emailVerificationToken.findFirst({
    where: {
      email,
      token,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!tokenRecord) {
    return sendError(res, 'Invalid or expired verification link', 400);
  }

  const user = await prisma.$transaction(async (tx) => {
    const password = String(req.body.password || '').trim();
    if (password) {
      if (password.length < 8) {
        const error = new Error('Password must be at least 8 characters long');
        error.statusCode = 422;
        error.payload = { password: 'Password must be at least 8 characters long' };
        throw error;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await tx.user.update({
        where: { email },
        data: {
          isActive: true,
          emailVerifiedAt: new Date(),
          passwordHash
        }
      });
    } else {
      await tx.user.update({
        where: { email },
        data: {
          isActive: true,
          emailVerifiedAt: new Date()
        }
      });
    }

    await tx.emailVerificationToken.deleteMany({
      where: { email }
    });

    const activeUser = await tx.user.findUnique({
      where: { email }
    });

    const memberCheck = await tx.workspaceMember.findFirst({
      where: { userId: activeUser.id },
      select: { id: true }
    });

    if (!memberCheck) {
      const orgName = `${activeUser.firstName}'s Team`;
      const orgSlug = createSlug(`${activeUser.firstName}-team-${Date.now()}`);

      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          subscriptionTier: 'free'
        }
      });

      const wsName = 'General Workspace';
      const wsSlug = 'general-' + Math.random().toString(36).substring(2, 7);

      const ws = await tx.workspace.create({
        data: {
          organizationId: org.id,
          name: wsName,
          slug: wsSlug
        }
      });

      const role = await createRoleWithPermissions(tx, {
        workspaceId: ws.id,
        name: 'Admin',
        description: 'Full administrative access',
        isSystemRole: false
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId: activeUser.id,
          roleId: role.id,
          role: 'Admin'
        }
      });
    }

    return activeUser;
  });

  req.session.user_id = user.id;
  req.session.user_email = user.email;

  return sendSuccess(res, {
    user: {
      id: user.publicId,
      public_id: user.publicId,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt,
    },
    message: 'Email verified successfully. Welcome to Zentrix!',
  });
}));

authRouter.get('/check-token', asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim();
  const token = String(req.query.token || '').trim();

  if (!email || !token) {
    return sendError(res, 'Missing email or token', 400);
  }

  const tokenRecord = await prisma.emailVerificationToken.findFirst({
    where: {
      email,
      token,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!tokenRecord) {
    return sendError(res, 'Invalid or expired verification link', 400);
  }

  return sendSuccess(res, { message: 'Token is valid' });
}));

authRouter.post('/verify-otp', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const otpCode = String(req.body.otp_code || '').trim();

  if (!email || !otpCode) {
    return sendValidationError(res, {
      email: !email ? 'Email is required' : undefined,
      otp_code: !otpCode ? 'Verification code is required' : undefined
    });
  }

  const otpRecord = await prisma.emailOtpVerification.findFirst({
    where: {
      email,
      otpCode,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!otpRecord) {
    return sendError(res, 'Invalid or expired verification code', 400);
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { email },
      data: {
        isActive: true,
        emailVerifiedAt: new Date()
      }
    });

    await tx.emailOtpVerification.deleteMany({
      where: { email }
    });

    const activeUser = await tx.user.findUnique({
      where: { email }
    });

    const memberCheck = await tx.workspaceMember.findFirst({
      where: { userId: activeUser.id },
      select: { id: true }
    });

    if (!memberCheck) {
      const orgName = `${activeUser.firstName}'s Team`;
      const orgSlug = createSlug(`${activeUser.firstName}-team-${Date.now()}`);

      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          subscriptionTier: 'free'
        }
      });

      const wsName = 'General Workspace';
      const wsSlug = 'general-' + Math.random().toString(36).substring(2, 7);

      const ws = await tx.workspace.create({
        data: {
          organizationId: org.id,
          name: wsName,
          slug: wsSlug
        }
      });

      const role = await createRoleWithPermissions(tx, {
        workspaceId: ws.id,
        name: 'Admin',
        description: 'Full administrative access',
        isSystemRole: false
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId: activeUser.id,
          roleId: role.id,
          role: 'Admin'
        }
      });
    }

    return activeUser;
  });

  req.session.user_id = user.id;
  req.session.user_email = user.email;

  return sendSuccess(res, {
    user: {
      id: user.publicId,
      public_id: user.publicId,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt,
    },
    message: 'Email verified successfully. Your workspace has been set up.',
  });
}));

authRouter.post('/resend-otp', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();

  if (!email) {
    return sendValidationError(res, { email: 'Email is required' });
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { firstName: true, isActive: true }
  });

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  if (user.isActive) {
    return sendError(res, 'Email is already verified', 400);
  }

  await prisma.emailOtpVerification.deleteMany({
    where: { email }
  });

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  await prisma.emailOtpVerification.create({
    data: {
      email,
      otpCode,
      expiresAt
    }
  });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f766e;">New Verification Code</h2>
      <p>Hi ${user.firstName},</p>
      <p>You requested a new verification code. Please use the following code to activate your Zentrix account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f766e; background-color: #f3f4f6; padding: 10px 20px; border-radius: 8px; border: 1px solid #e2e8f0;">${otpCode}</span>
      </div>
      <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">This code will expire in 10 minutes.</p>
    </div>
  `;

  await sendMail({
    to: email,
    subject: 'Zentrix - Your New Verification Code',
    html: htmlContent,
  });

  return sendSuccess(res, { message: 'New verification code sent successfully.' });
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  req.session.destroy(() => { });
  res.clearCookie('task_management.sid');
  return sendSuccess(res, { message: 'Logout successful' });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    user: {
      id: req.currentUser.public_id,
      public_id: req.currentUser.public_id,
      email: req.currentUser.email,
      first_name: req.currentUser.first_name,
      last_name: req.currentUser.last_name,
      avatar_url: req.currentUser.avatar_url,
      created_at: req.currentUser.created_at,
    }
  });
}));

authRouter.post('/forgot-password', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();

  if (!email) {
    return sendValidationError(res, { email: 'Email is required' });
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      isActive: true
    },
    select: { id: true, firstName: true }
  });

  if (!user) {
    return sendSuccess(res, { message: 'If that email exists, a reset link has been sent.' });
  }

  await prisma.passwordReset.deleteMany({
    where: { email }
  });

  const token = crypto.randomBytes(32).toString('hex');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  await prisma.passwordReset.create({
    data: {
      email,
      token,
      expiresAt
    }
  });

  const resetLink = `${env.appOrigin}/reset-password?token=${token}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f766e;">Password Reset Request</h2>
      <p>Hi ${user.firstName},</p>
      <p>We received a request to reset your password for your Zentrix account. If you didn't request this, you can safely ignore this email.</p>
      <p>To reset your password, click the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #64748b; font-size: 14px;">${resetLink}</p>
      <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">This link will expire in 1 hour.</p>
    </div>
  `;

  await sendMail({
    to: email,
    subject: 'Zentrix - Password Reset Request',
    html: htmlContent,
  });

  return sendSuccess(res, { message: 'If that email exists, a reset link has been sent.' });
}));

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  const newPassword = String(req.body.password || '');
  const errors = {};

  if (!token) {
    errors.token = 'Reset token is missing or invalid';
  }

  if (!newPassword) {
    errors.password = 'New password is required';
  } else if (newPassword.length < 8) {
    errors.password = 'Password must be at least 8 characters long';
  }

  if (Object.keys(errors).length > 0) {
    return sendValidationError(res, errors);
  }

  const resetRecord = await prisma.passwordReset.findFirst({
    where: {
      token,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!resetRecord) {
    return sendError(res, 'This password reset link is invalid or has expired. Please request a new one.', 400);
  }

  const email = resetRecord.email;
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { email },
      data: { passwordHash }
    });

    await tx.passwordReset.deleteMany({
      where: { email }
    });

    await tx.passwordReset.deleteMany({
      where: {
        expiresAt: {
          lte: new Date()
        }
      }
    });
  });

  return sendSuccess(res, { message: 'Password has been successfully reset.' });
}));

module.exports = { authRouter };
