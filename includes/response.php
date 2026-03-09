<?php
/**
 * Response Utility
 * 
 * Standardized JSON response helpers for API endpoints.
 */

/**
 * Send a successful JSON response
 * 
 * @param mixed $data The data to return
 * @param int $status_code HTTP status code (default: 200)
 */
function send_success($data, $status_code = 200) {
  header('Content-Type: application/json');
  http_response_code($status_code);
  echo json_encode([
    'success' => true,
    'data' => $data
  ]);
  exit;
}

/**
 * Send an error JSON response
 * 
 * @param string $error_message User-friendly error message
 * @param int $status_code HTTP status code (default: 400)
 */
function send_error($error_message, $status_code = 400) {
  header('Content-Type: application/json');
  http_response_code($status_code);
  echo json_encode([
    'success' => false,
    'error_message' => $error_message
  ]);
  exit;
}

/**
 * Send a validation error response
 * 
 * @param array $errors Array of validation errors
 * @param int $status_code HTTP status code (default: 422)
 */
function send_validation_error($errors, $status_code = 422) {
  header('Content-Type: application/json');
  http_response_code($status_code);
  echo json_encode([
    'success' => false,
    'error_message' => 'Validation failed',
    'errors' => $errors
  ]);
  exit;
}
