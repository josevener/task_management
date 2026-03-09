<?php
/**
 * Registration API Endpoint
 * POST /api/auth/register
 * 
 * Creates a new user account.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

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

  $email = trim($input['email'] ?? '');
  $password = $input['password'] ?? '';
  $first_name = trim($input['first_name'] ?? '');
  $last_name = trim($input['last_name'] ?? '');

  // Validate input
  $errors = [];

  if (empty($email)) {
    $errors['email'] = 'Email is required';
  } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Invalid email format';
  }

  if (empty($password)) {
    $errors['password'] = 'Password is required';
  } elseif (strlen($password) < 8) {
    $errors['password'] = 'Password must be at least 8 characters long';
  }

  if (empty($first_name)) {
    $errors['first_name'] = 'First name is required';
  }

  if (empty($last_name)) {
    $errors['last_name'] = 'Last name is required';
  }

  if (!empty($errors)) {
    send_validation_error($errors);
  }

  // Check if email already exists
  $db = Database::getInstance()->getConnection();
  $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
  $stmt->execute([$email]);
  
  if ($stmt->fetch()) {
    send_validation_error([
      'email' => 'Email already registered'
    ]);
  }

  // Create new user
  $password_hash = hash_password($password);
  
  $stmt = $db->prepare("
    INSERT INTO users (email, password_hash, first_name, last_name)
    VALUES (?, ?, ?, ?)
  ");
  
  $stmt->execute([$email, $password_hash, $first_name, $last_name]);
  $user_id = $db->lastInsertId();

  // Get created user (without password)
  $stmt = $db->prepare("
    SELECT id, email, first_name, last_name, avatar_url, created_at
    FROM users
    WHERE id = ?
  ");
  $stmt->execute([$user_id]);
  $user = $stmt->fetch();

  // Auto-login after registration
  start_session();
  $_SESSION['user_id'] = $user['id'];
  $_SESSION['user_email'] = $user['email'];

  send_success([
    'user' => $user,
    'message' => 'Registration successful'
  ], 201);
} catch (PDOException $e) {
  error_log('Registration endpoint error: ' . $e->getMessage());
  send_error('An error occurred during registration. Please try again.', 500);
} catch (Exception $e) {
  error_log('Registration endpoint error: ' . $e->getMessage());
  send_error('An error occurred during registration. Please try again.', 500);
}
