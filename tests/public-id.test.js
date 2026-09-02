const test = require('node:test');
const assert = require('node:assert/strict');
const { createPublicId, isValidPublicId, requirePublicId } = require('../utils/public-id');

test('public IDs are opaque, typed, and validate only for their assigned model', () => {
  const projectId = createPublicId('Project');

  assert.match(projectId, /^prj_[a-f0-9]{32}$/);
  assert.equal(isValidPublicId('Project', projectId), true);
  assert.equal(isValidPublicId('Task', projectId), false);
  assert.notEqual(createPublicId('Project'), projectId);
});

test('invalid public IDs produce safe validation metadata', () => {
  assert.throws(
    () => requirePublicId('Organization', '12'),
    (error) => error.validationErrors?.id === 'A valid org_ public ID is required'
  );
});
