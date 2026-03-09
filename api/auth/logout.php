<?php
/**
 * Logout API Endpoint
 * POST /api/auth/logout
 * 
 * Logs out the current user and destroys the session.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';

header('Content-Type: application/json');

try {
  // Only allow POST requests
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed', 405);
  }

  logout_user();
  
  send_success([
    'message' => 'Logout successful'
  ]);
} catch (Exception $e) {
  error_log('Logout endpoint error: ' . $e->getMessage());
  send_error('An error occurred during logout. Please try again.', 500);
}
