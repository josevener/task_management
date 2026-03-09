<?php
/**
 * Delete Organization API Endpoint
 * DELETE /api/organizations/delete.php?id={id}
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    send_error('Method not allowed', 405);
  }

  $org_id = $_GET['id'] ?? null;

  if (empty($org_id)) {
    send_validation_error(['id' => 'Organization ID is required']);
  }

  // Verify Organization exists and user is admin of its default workspace
  $stmt = $db->prepare("
    SELECT o.id, wm.role 
    FROM organizations o
    INNER JOIN workspaces w ON w.organization_id = o.id
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE o.id = ? AND wm.user_id = ? AND wm.role = 'admin'
    LIMIT 1
  ");
  $stmt->execute([$org_id, $user_id]);
  $existing_org = $stmt->fetch();

  if (!$existing_org) {
    send_error('Organization not found or you do not have permission to delete it', 404);
  }

  // Soft delete or hard delete? Let's hard delete for MVP via cascading.
  // Workspaces table has ON DELETE CASCADE to organizations.
  $stmt = $db->prepare("DELETE FROM organizations WHERE id = ?");
  $stmt->execute([$org_id]);

  send_success(['message' => 'Organization deleted successfully']);

} catch (Exception $e) {
  error_log('Organizations delete endpoint error: ' . $e->getMessage());
  send_error('An error occurred while deleting the organization.', 500);
}
