UPDATE member_roles
SET role = 'member'
WHERE role = 'viewer';

UPDATE member_roles
SET role = 'admin'
WHERE role = 'editor';

-- Owner is legacy and is intentionally not restored.
