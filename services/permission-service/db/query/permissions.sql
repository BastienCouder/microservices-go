-- name: CountMatchingPolicies :one
SELECT COUNT(1)
FROM permission_role_policies
WHERE organization_id = ANY($1::bigint[])
  AND role = ANY($2::text[])
  AND action = ANY($3::text[])
  AND resource = ANY($4::text[]);
