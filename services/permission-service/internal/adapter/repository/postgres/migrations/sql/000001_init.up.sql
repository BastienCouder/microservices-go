CREATE TABLE IF NOT EXISTS permission_role_policies (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  UNIQUE (organization_id, role, action, resource)
);

CREATE INDEX IF NOT EXISTS idx_permission_lookup
  ON permission_role_policies (organization_id, role, action, resource);

INSERT INTO permission_role_policies (organization_id, role, action, resource)
VALUES
  (0, 'viewer', 'read', '*'),
  (0, 'editor', 'read', '*'),
  (0, 'editor', 'create', '*'),
  (0, 'editor', 'update', '*'),
  (0, 'editor', 'delete', '*')
ON CONFLICT (organization_id, role, action, resource) DO NOTHING;
