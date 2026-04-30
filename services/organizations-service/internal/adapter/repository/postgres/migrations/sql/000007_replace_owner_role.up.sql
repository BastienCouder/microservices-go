INSERT INTO member_roles (organization_id, user_id, role)
SELECT organization_id, user_id, 'admin'
FROM member_roles
WHERE role = 'owner'
ON CONFLICT DO NOTHING;

DELETE FROM member_roles
WHERE role = 'owner';
