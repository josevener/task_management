<?php
/**
 * Get Current User API Endpoint
 * GET /api/auth/me
 * 
 * Returns the currently authenticated user's information.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';

header('Content-Type: application/json');

try {
  // Only allow GET requests
  if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_error('Method not allowed', 405);
  }

  require_auth();

  $user = get_authenticated_user();

  if ($user) {
    send_success(['user' => $user]);
  } else {
    send_error('User not found', 404);
  }
} catch (Exception $e) {
  error_log('Get current user endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
