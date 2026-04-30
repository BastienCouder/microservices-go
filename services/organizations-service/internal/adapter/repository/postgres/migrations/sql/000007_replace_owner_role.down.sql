INSERT INTO member_roles (organization_id, user_id, role)
SELECT id, owner_user_id, 'owner'
FROM organizations
WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;
