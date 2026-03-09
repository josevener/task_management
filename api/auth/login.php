<?php
/**
 * Login API Endpoint
 * POST /api/auth/login
 * 
 * Authenticates a user and creates a session.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';

header('Content-Type: application/json');

try {
  // Only allow POST requests
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed', 405);
  }

  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input) {
    send_error('Invalid JSON input', 400);
  }

  $email = $input['email'] ?? '';
  $password = $input['password'] ?? '';

  // Validate input
  if (empty($email) || empty($password)) {
    send_validation_error([
      'email' => empty($email) ? 'Email is required' : null,
      'password' => empty($password) ? 'Password is required' : null
    ]);
  }

  // Validate email format
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    send_validation_error([
      'email' => 'Invalid email format'
    ]);
  }

  // Attempt login
  $user = login_user($email, $password);

  if ($user) {
    send_success([
      'user' => $user,
      'message' => 'Login successful'
    ]);
  } else {
    send_error('Invalid email or password', 401);
  }
} catch (Exception $e) {
  error_log('Login endpoint error: ' . $e->getMessage());
  send_error('An error occurred during login. Please try again.', 500);
}
