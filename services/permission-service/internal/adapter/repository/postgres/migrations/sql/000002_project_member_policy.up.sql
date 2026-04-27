INSERT INTO permission_role_policies (organization_id, role, action, resource)
VALUES
  (0, 'project_member', 'read', 'organizations'),
  (0, 'project_member', 'read', 'projects'),
  (0, 'project_member', 'read', 'analysis'),
  (0, 'project_member', 'read', 'attribution')
ON CONFLICT (organization_id, role, action, resource) DO NOTHING;
