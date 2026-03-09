<?php
/**
 * Update Organization API Endpoint
 * PUT /api/organizations/update.php?id={id}
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'PATCH') {
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
    send_error('Organization not found or you do not have permission to edit it', 404);
  }

  // Get JSON input
  $input = json_decode(file_get_contents('php://input'), true);

  if (!$input) {
    send_error('Invalid JSON input', 400);
  }

  $updates = [];
  $params = [];
  $allowed_fields = ['name', 'slug', 'subscription_tier', 'logo_url'];

  foreach ($allowed_fields as $field) {
    if (isset($input[$field])) {
      if ($field === 'name') {
        $value = trim($input[$field]);
        if (empty($value)) {
          send_validation_error(['name' => 'Organization name cannot be empty']);
        }
      } elseif ($field === 'slug') {
        $value = trim($input[$field]);
        if (empty($value)) {
           send_validation_error(['slug' => 'Slug cannot be empty']);
        }
        // Check for unique slug excluding current
        $slugCheck = $db->prepare('SELECT id FROM organizations WHERE slug = ? AND id != ?');
        $slugCheck->execute([$value, $org_id]);
        if ($slugCheck->fetch()) {
            send_validation_error(['slug' => 'Slug must be unique']);
        }
      }
      
      $updates[] = "{$field} = ?";
      $params[] = $input[$field] ?: null;
    }
  }

  if (empty($updates)) {
    send_error('No fields to update', 400);
  }

  $params[] = $org_id;
  $update_clause = implode(', ', $updates);
  
  $stmt = $db->prepare("
    UPDATE organizations 
    SET {$update_clause}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  ");
  $stmt->execute($params);

  // Return updated organization
  $stmt = $db->prepare("SELECT * FROM organizations WHERE id = ?");
  $stmt->execute([$org_id]);
  $organization = $stmt->fetch();

  send_success(['organization' => $organization]);

} catch (Exception $e) {
  error_log('Organizations update endpoint error: ' . $e->getMessage());
  send_error('An error occurred while updating the organization.', 500);
}
