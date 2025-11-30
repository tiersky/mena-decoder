-- Migration: Add net_budget columns for tracking actual negotiated spend vs ratecard
-- This allows tracking the effectiveness of media negotiations for offline media

-- Add net_budget columns to unified_competitive_stats
ALTER TABLE unified_competitive_stats
ADD COLUMN IF NOT EXISTS net_budget TEXT,
ADD COLUMN IF NOT EXISTS net_budget_numeric NUMERIC(15, 2);

-- Create index for net_budget_numeric for faster sorting/filtering
CREATE INDEX IF NOT EXISTS idx_unified_stats_net_budget_numeric
ON unified_competitive_stats(net_budget_numeric DESC);

-- Migration helper: Convert existing net_budget text to numeric
-- Run this after importing data with net_budget values
UPDATE unified_competitive_stats
SET net_budget_numeric = CASE
    WHEN net_budget IS NOT NULL AND net_budget != '' THEN
        CAST(REGEXP_REPLACE(REGEXP_REPLACE(net_budget, '[$,]', '', 'g'), '[^0-9.]', '', 'g') AS NUMERIC(15, 2))
    ELSE NULL
END
WHERE net_budget IS NOT NULL AND net_budget != '';
