<?php
/**
 * Get Single Workspace API Endpoint
 * GET /api/workspaces/get.php?id={workspace_id}
 * 
 * Returns a single workspace by ID (if user has access)
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_error('Method not allowed', 405);
  }

  $workspace_id = $_GET['id'] ?? null;

  if (empty($workspace_id)) {
    send_validation_error(['id' => 'Workspace ID is required']);
  }

  // Get workspace and verify user has access
  $stmt = $db->prepare("
    SELECT w.id, w.organization_id, w.name, w.slug, w.description,
           w.logo_url, w.color_theme, w.created_at, w.updated_at,
           o.name as organization_name
    FROM workspaces w
    INNER JOIN organizations o ON o.id = w.organization_id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE w.id = ? AND wm.user_id = ? AND w.is_active = TRUE
  ");
  $stmt->execute([$workspace_id, $user_id]);
  $workspace = $stmt->fetch();

  if (!$workspace) {
    send_error('Workspace not found or access denied', 404);
  }

  // Get user's role in this workspace
  $stmt = $db->prepare("
    SELECT role FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  ");
  $stmt->execute([$workspace_id, $user_id]);
  $member = $stmt->fetch();
  $workspace['user_role'] = $member['role'] ?? null;

  send_success(['workspace' => $workspace]);
} catch (Exception $e) {
  error_log('Get workspace endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
