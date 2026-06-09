DROP TABLE IF EXISTS billing_pricing_tiers;

DELETE FROM billing_plan_settings
WHERE plan = 'developer';
