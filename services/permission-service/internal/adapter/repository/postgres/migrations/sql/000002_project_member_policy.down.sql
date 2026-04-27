DELETE FROM permission_role_policies
WHERE organization_id = 0
  AND role = 'project_member'
  AND action = 'read'
  AND resource IN ('organizations', 'projects', 'analysis', 'attribution');
