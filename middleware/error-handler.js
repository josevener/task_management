const { sendError } = require('../utils/responses');

function errorHandler(error, _req, res, _next) {
  console.error(error);
  return sendError(res, 'An error occurred. Please try again.', 500);
}

module.exports = { errorHandler };
