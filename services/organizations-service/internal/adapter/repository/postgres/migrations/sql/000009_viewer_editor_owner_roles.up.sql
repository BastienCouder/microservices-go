INSERT INTO member_roles (organization_id, user_id, role)
SELECT id, owner_user_id, 'editor'
FROM organizations
WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO member_roles (organization_id, user_id, role)
SELECT organization_id, user_id, 'viewer'
FROM member_roles
WHERE role = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO member_roles (organization_id, user_id, role)
SELECT organization_id, user_id, 'editor'
FROM member_roles
WHERE role IN ('admin', 'owner')
ON CONFLICT DO NOTHING;

DELETE FROM member_roles
WHERE role IN ('member', 'admin', 'owner', 'project_member');
