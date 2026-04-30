INSERT INTO member_roles (organization_id, user_id, role)
SELECT organization_id, user_id, 'member'
FROM member_roles
WHERE role = 'project_member'
ON CONFLICT (organization_id, user_id, role) DO NOTHING;

DELETE FROM member_roles
WHERE role = 'project_member';
