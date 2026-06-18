ALTER TABLE prompt_runs
ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'monitoring';

UPDATE prompt_runs pr
SET kind = CASE
  WHEN ar.run_type = 'perception' THEN 'perception'
  ELSE 'monitoring'
END
FROM analysis_runs ar
WHERE ar.id = pr.run_id
  AND (pr.kind IS NULL OR pr.kind = '' OR pr.kind = 'monitoring');
