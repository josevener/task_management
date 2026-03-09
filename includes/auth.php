<?php
/**
 * Authentication Utility
 * 
 * Handles user authentication, session management, and authorization.
 */

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/response.php';

/**
 * Start session if not already started
 */
function start_session() {
  if (session_status() === PHP_SESSION_NONE) {
    session_start();
  }
}

/**
 * Check if user is authenticated
 * 
 * @return bool
 */
function is_authenticated() {
  start_session();
  return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

/**
 * Get current authenticated user ID
 * 
 * @return int|null
 */
function get_current_user_id() {
  start_session();
  return $_SESSION['user_id'] ?? null;
}

/**
 * Get current authenticated user data
 * 
 * @return array|null
 */
function get_authenticated_user() {
  if (!is_authenticated()) {
    return null;
  }

  $db = Database::getInstance()->getConnection();
  $user_id = get_current_user_id();

  try {
    $stmt = $db->prepare("
      SELECT id, email, first_name, last_name, avatar_url, created_at
      FROM users
      WHERE id = ? AND is_active = TRUE
    ");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();

    return $user ?: null;
  } catch (PDOException $e) {
    error_log('Error fetching current user: ' . $e->getMessage());
    return null;
  }
}

/**
 * Require authentication - redirects or returns error if not authenticated
 * 
 * @param bool $return_json If true, returns JSON error; if false, redirects to login
 */
function require_auth($return_json = true) {
  if (!is_authenticated()) {
    if ($return_json) {
      send_error('Authentication required', 401);
    } else {
      header('Location: /login');
      exit;
    }
  }
}

/**
 * Hash a password
 * 
 * @param string $password Plain text password
 * @return string Hashed password
 */
function hash_password($password) {
  return password_hash($password, PASSWORD_BCRYPT);
}

/**
 * Verify a password
 * 
 * @param string $password Plain text password
 * @param string $hash Hashed password
 * @return bool
 */
function verify_password($password, $hash) {
  return password_verify($password, $hash);
}

/**
 * Login a user
 * 
 * @param string $email User email
 * @param string $password Plain text password
 * @return array|false User data on success, false on failure
 */
function login_user($email, $password) {
  $db = Database::getInstance()->getConnection();

  try {
    $stmt = $db->prepare("
      SELECT id, email, password_hash, first_name, last_name, avatar_url
      FROM users
      WHERE email = ? AND is_active = TRUE
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && verify_password($password, $user['password_hash'])) {
      start_session();
      $_SESSION['user_id'] = $user['id'];
      $_SESSION['user_email'] = $user['email'];
      
      // Remove password hash from returned data
      unset($user['password_hash']);
      
      return $user;
    }

    return false;
  } catch (PDOException $e) {
    error_log('Login error: ' . $e->getMessage());
    return false;
  }
}

/**
 * Logout current user
 */
function logout_user() {
  start_session();
  $_SESSION = [];
  
  if (isset($_COOKIE[session_name()])) {
    setcookie(session_name(), '', time() - 3600, '/');
  }
  
  session_destroy();
}
