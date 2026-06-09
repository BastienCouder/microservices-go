INSERT INTO permission_role_policies (organization_id, role, action, resource)
SELECT organization_id, 'viewer', action, resource
FROM permission_role_policies
WHERE role = 'member'
ON CONFLICT (organization_id, role, action, resource) DO NOTHING;

INSERT INTO permission_role_policies (organization_id, role, action, resource)
SELECT organization_id, 'editor', action, resource
FROM permission_role_policies
WHERE role IN ('admin', 'owner')
ON CONFLICT (organization_id, role, action, resource) DO NOTHING;

INSERT INTO permission_role_policies (organization_id, role, action, resource)
VALUES
  (0, 'viewer', 'read', '*'),
  (0, 'editor', 'read', '*'),
  (0, 'editor', 'create', '*'),
  (0, 'editor', 'update', '*'),
  (0, 'editor', 'delete', '*')
ON CONFLICT (organization_id, role, action, resource) DO NOTHING;

DELETE FROM permission_role_policies
WHERE role IN ('member', 'admin', 'owner', 'project_member');
