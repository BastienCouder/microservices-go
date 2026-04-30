INSERT INTO permission_role_policies (organization_id, role, action, resource)
VALUES
  (0, 'member', 'read', 'members')
ON CONFLICT (organization_id, role, action, resource) DO NOTHING;
