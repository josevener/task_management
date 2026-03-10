function isValidDate(value) {
  if (!value) {
    return true;
  }

  return !Number.isNaN(Date.parse(value));
}

function buildUpdateClause(input, allowedFields) {
  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      updates.push(`${field} = ?`);
      params.push(input[field] === '' ? null : input[field]);
    }
  }

  return { updates, params };
}

module.exports = { isValidDate, buildUpdateClause };
