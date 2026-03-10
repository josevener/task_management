const { sendError } = require('../utils/responses');

function notFoundHandler(_req, res) {
  return sendError(res, 'Route not found', 404);
}

module.exports = { notFoundHandler };
