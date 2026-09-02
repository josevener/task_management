const crypto = require('crypto');

const MODEL_PREFIXES = Object.freeze({
  Organization: 'org',
  User: 'usr',
  Workspace: 'wsp',
  WorkspaceMember: 'wmb',
  Project: 'prj',
  ProjectMember: 'pmb',
  Task: 'tsk',
  TaskDependency: 'tdp',
  TaskTag: 'tag',
  TaskTagAssignment: 'tta',
  TaskFollower: 'tfl',
  Comment: 'cmt',
  CommentMention: 'cmn',
  ActivityLog: 'act',
  Notification: 'ntf',
  Attachment: 'att',
  Permission: 'per',
  Role: 'rol',
  WorkspaceInvitation: 'win',
  RolePermission: 'rpe',
  EmailVerificationToken: 'evt',
  EmailOtpVerification: 'eov',
  PasswordReset: 'pwr',
  Session: 'ses'
});

const PUBLIC_ID_PATTERN = /^[a-z]{3}_[a-f0-9]{32}$/;

function createPublicId(model) {
  const prefix = MODEL_PREFIXES[model];
  if (!prefix) {
    throw new Error(`No public ID prefix registered for Prisma model: ${model}`);
  }

  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function isValidPublicId(model, value) {
  return typeof value === 'string'
    && value.length === 36
    && PUBLIC_ID_PATTERN.test(value)
    && value.startsWith(`${MODEL_PREFIXES[model]}_`);
}

function requirePublicId(model, value, field = 'id') {
  if (!isValidPublicId(model, value)) {
    const error = new Error(`Invalid ${model} public ID`);
    error.validationErrors = { [field]: `A valid ${MODEL_PREFIXES[model]}_ public ID is required` };
    throw error;
  }
  return value;
}

function withPublicId(model, data) {
  if (!MODEL_PREFIXES[model] || !data || data.publicId) return data;
  return { ...data, publicId: createPublicId(model) };
}

function delegateForModel(model) {
  return `${model[0].toLowerCase()}${model.slice(1)}`;
}

async function resolveInternalId(prisma, model, value, field = 'id') {
  requirePublicId(model, value, field);
  const record = await prisma[delegateForModel(model)].findUnique({
    where: { publicId: value },
    select: { id: true }
  });
  return record?.id || null;
}

function publicIdParam(prisma, model) {
  return async (req, res, next, value) => {
    try {
      const id = await resolveInternalId(prisma, model, value);
      if (!id) return res.status(404).json({ success: false, error_message: `${model} not found or access denied` });
      req.params[Object.keys(req.params).find((key) => req.params[key] === value) || 'id'] = String(id);
      return next();
    } catch (error) {
      if (error.validationErrors) return res.status(422).json({ success: false, error_message: 'Validation failed', errors: error.validationErrors });
      return next(error);
    }
  };
}

module.exports = {
  MODEL_PREFIXES,
  createPublicId,
  isValidPublicId,
  requirePublicId,
  withPublicId,
  resolveInternalId,
  publicIdParam
};
