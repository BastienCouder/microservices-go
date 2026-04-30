DELETE FROM permission_role_policies
WHERE organization_id = 0
  AND action = 'read'
  AND resource = 'members'
  AND role = 'member';
