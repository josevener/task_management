function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

function sendError(res, errorMessage, statusCode = 400, errors) {
  return res.status(statusCode).json({
    success: false,
    error_message: errorMessage,
    ...(errors ? { errors } : {}),
  });
}

function sendValidationError(res, errors, statusCode = 422) {
  return sendError(res, 'Validation failed', statusCode, errors);
}

module.exports = { sendSuccess, sendError, sendValidationError };
