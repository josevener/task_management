<?php
/**
 * Workspace Members API Endpoint
 * GET /api/workspaces/members.php?workspace_id={id} - List members
 * POST /api/workspaces/members.php - Add a new member by email
 * DELETE /api/workspaces/members.php?id={id} - Remove a workspace member by membership ID
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/database.php';

header('Content-Type: application/json');

try {
  require_auth();
  $db = Database::getInstance()->getConnection();
  $current_user_id = get_current_user_id();

  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $workspace_id = $_GET['workspace_id'] ?? null;

    if (empty($workspace_id)) {
      send_validation_error(['workspace_id' => 'Workspace ID is required']);
    }

    // Verify current user has access to this workspace
    $stmt = $db->prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?");
    $stmt->execute([$workspace_id, $current_user_id]);
    if (!$stmt->fetch()) {
      send_error('Workspace access denied', 403);
    }

    $stmt = $db->prepare("
      SELECT wm.id as membership_id, wm.role, wm.created_at,
             u.id as user_id, u.first_name, u.last_name, u.email
      FROM workspace_members wm
      INNER JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ?
      ORDER BY wm.created_at ASC
    ");
    $stmt->execute([$workspace_id]);
    $members = $stmt->fetchAll();

    send_success(['members' => $members]);
  } 
  elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Add member (Invite existing or Create new)
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
      send_error('Invalid JSON input', 400);
    }

    $workspace_id = $input['workspace_id'] ?? null;
    $email = trim($input['email'] ?? '');
    $role = $input['role'] ?? 'member';
    $action = $input['action'] ?? 'invite'; // 'invite' or 'create'

    $errors = [];
    if (empty($workspace_id)) {
      $errors['workspace_id'] = 'Workspace ID is required';
    }
    if (empty($email)) {
      $errors['email'] = 'Email is required';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      $errors['email'] = 'Invalid email format';
    }

    $valid_roles = ['admin', 'manager', 'member', 'guest'];
    if (!in_array($role, $valid_roles)) {
      $errors['role'] = 'Invalid role. Must be one of: ' . implode(', ', $valid_roles);
    }

    // Verify current user is admin or manager
    if ($workspace_id) {
      $stmt = $db->prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?");
      $stmt->execute([$workspace_id, $current_user_id]);
      $admin_check = $stmt->fetch();
      
      if (!$admin_check || !in_array($admin_check['role'], ['admin', 'manager'])) {
        $errors['workspace_id'] = 'You do not have permission to add members to this workspace';
      }
    }

    // If 'create', validate additional required fields
    if ($action === 'create') {
        $first_name = trim($input['first_name'] ?? '');
        $last_name = trim($input['last_name'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($first_name)) $errors['first_name'] = 'First name is required';
        if (empty($last_name)) $errors['last_name'] = 'Last name is required';
        if (empty($password)) {
            $errors['password'] = 'Password is required';
        } elseif (strlen($password) < 8) {
            $errors['password'] = 'Password must be at least 8 characters long';
        }
    }

    if (!empty($errors)) {
      send_validation_error($errors);
    }

    $db->beginTransaction();
    try {
        if ($action === 'create') {
            // 1. Check if email already exists
            $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                send_validation_error(['email' => 'User with this email already exists in the system. Use the Invite method instead.']);
            }

            // 2. Create the User
            $password_hash = hash_password($password);
            $stmt = $db->prepare("
                INSERT INTO users (email, password_hash, first_name, last_name)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$email, $password_hash, $first_name, $last_name]);
            $user_id_to_add = $db->lastInsertId();
        } else {
            // Find the user by email
            $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user_to_add = $stmt->fetch();

            if (!$user_to_add) {
                send_error('No user found with that email address. They must register first.', 400);
            }
            $user_id_to_add = $user_to_add['id'];
        }

        // Check if already in the workspace
        $stmt = $db->prepare("SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?");
        $stmt->execute([$workspace_id, $user_id_to_add]);
        if ($stmt->fetch()) {
            // If we just created them, they wouldn't be here, but good safeguard.
            if ($action === 'create') {
                 $db->rollBack();
            }
            send_error('User is already a member of this workspace', 409);
        }

        // Insert
        $stmt = $db->prepare("
            INSERT INTO workspace_members (workspace_id, user_id, role)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$workspace_id, $user_id_to_add, $role]);
        $membership_id = $db->lastInsertId();

        $db->commit();

        // Return the created member record
        $stmt = $db->prepare("
            SELECT wm.id as membership_id, wm.role, wm.created_at,
                   u.id as user_id, u.first_name, u.last_name, u.email
            FROM workspace_members wm
            INNER JOIN users u ON u.id = wm.user_id
            WHERE wm.id = ?
        ");
        $stmt->execute([$membership_id]);
        $member = $stmt->fetch();

        send_success(['member' => $member], 201);
    } catch (Exception $e) {
        $db->rollBack();
        throw $e;
    }
  }
  elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $membership_id = $_GET['id'] ?? null;

    if (empty($membership_id)) {
      send_validation_error(['id' => 'Membership ID is required']);
    }

    // Get the workspace of this membership to check permissions
    $stmt = $db->prepare("SELECT workspace_id, user_id, role FROM workspace_members WHERE id = ?");
    $stmt->execute([$membership_id]);
    $target_member = $stmt->fetch();

    if (!$target_member) {
      send_error('Membership not found', 404);
    }

    $workspace_id = $target_member['workspace_id'];

    // Verify current user is admin or manager, OR is the user themselves (leaving workspace)
    if ($target_member['user_id'] != $current_user_id) {
        $stmt = $db->prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?");
        $stmt->execute([$workspace_id, $current_user_id]);
        $admin_check = $stmt->fetch();
        
        if (!$admin_check || !in_array($admin_check['role'], ['admin', 'manager'])) {
            send_error('You do not have permission to remove members from this workspace', 403);
        }
    }

    // Ensure we don't delete the last admin
    if ($target_member['role'] === 'admin') {
        $stmt = $db->prepare("SELECT COUNT(*) as admin_count FROM workspace_members WHERE workspace_id = ? AND role = 'admin'");
        $stmt->execute([$workspace_id]);
        $admin_count = $stmt->fetch()['admin_count'];
        
        if ($admin_count <= 1) {
            send_error('Cannot remove the last administrator. Promote someone else first.', 400);
        }
    }

    $stmt = $db->prepare("DELETE FROM workspace_members WHERE id = ?");
    $stmt->execute([$membership_id]);

    send_success(['message' => 'Member removed successfully']);
  }
  else {
    send_error('Method not allowed', 405);
  }

} catch (Exception $e) {
  error_log('Workspace Members endpoint error: ' . $e->getMessage());
  send_error('An error occurred. Please try again.', 500);
}
