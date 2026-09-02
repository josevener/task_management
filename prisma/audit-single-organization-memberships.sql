-- Run this read-only report before deploying the single-organization rule.
-- Resolve every returned user manually; this feature never deletes or moves
-- historical workspace memberships automatically.
SELECT
  u.public_id AS user_public_id,
  u.email,
  COUNT(DISTINCT w.organization_id) AS organization_count,
  GROUP_CONCAT(DISTINCT o.public_id ORDER BY o.public_id SEPARATOR ', ') AS organization_public_ids
FROM workspace_members AS wm
INNER JOIN users AS u ON u.id = wm.user_id
INNER JOIN workspaces AS w ON w.id = wm.workspace_id
INNER JOIN organizations AS o ON o.id = w.organization_id
GROUP BY u.id, u.public_id, u.email
HAVING COUNT(DISTINCT w.organization_id) > 1;
