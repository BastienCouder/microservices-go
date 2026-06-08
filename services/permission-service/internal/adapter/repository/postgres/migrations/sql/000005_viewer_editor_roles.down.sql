UPDATE permission_role_policies
SET role = 'member'
WHERE role = 'viewer';

UPDATE permission_role_policies
SET role = 'admin'
WHERE role = 'editor';
