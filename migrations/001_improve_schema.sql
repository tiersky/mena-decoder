-- Migration: Improve unified_competitive_stats schema for better AI query performance
-- Date: 2025-11-27
-- Purpose: Convert TEXT to NUMERIC, add indexes, enable semantic search with pgvector

-- Step 1: Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add new columns (don't drop old ones yet for safety)
ALTER TABLE unified_competitive_stats
ADD COLUMN IF NOT EXISTS budget_numeric NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS volume_numeric BIGINT,
ADD COLUMN IF NOT EXISTS embedding vector(1536); -- OpenAI embeddings are 1536 dimensions

-- Step 3: Migrate data from TEXT to NUMERIC
-- Remove commas and convert budget to numeric
UPDATE unified_competitive_stats
SET budget_numeric = CAST(REPLACE(REPLACE(budget, ',', ''), ' ', '') AS NUMERIC)
WHERE budget IS NOT NULL
  AND budget != ''
  AND budget ~ '^[0-9,. ]+$';

-- Remove commas and convert volume to numeric
UPDATE unified_competitive_stats
SET volume_numeric = CAST(REPLACE(REPLACE(volume, ',', ''), ' ', '') AS BIGINT)
WHERE volume IS NOT NULL
  AND volume != ''
  AND volume ~ '^[0-9, ]+$';

-- Step 4: Create indexes for fast filtering
-- Index on country for geographic queries
CREATE INDEX IF NOT EXISTS idx_unified_stats_country
ON unified_competitive_stats(country);

-- Index on brand for brand-specific queries
CREATE INDEX IF NOT EXISTS idx_unified_stats_brand
ON unified_competitive_stats(brand);

-- Index on media for media channel queries
CREATE INDEX IF NOT EXISTS idx_unified_stats_media
ON unified_competitive_stats(media);

-- Index on channel for specific channel queries
CREATE INDEX IF NOT EXISTS idx_unified_stats_channel
ON unified_competitive_stats(channel);

-- Index on date for time-based queries
CREATE INDEX IF NOT EXISTS idx_unified_stats_date
ON unified_competitive_stats(date);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_unified_stats_country_brand
ON unified_competitive_stats(country, brand);

-- Composite index for date range queries with brand
CREATE INDEX IF NOT EXISTS idx_unified_stats_brand_date
ON unified_competitive_stats(brand, date);

-- Index on budget for sorting and filtering by spend
CREATE INDEX IF NOT EXISTS idx_unified_stats_budget_numeric
ON unified_competitive_stats(budget_numeric DESC);

-- Step 5: Create vector similarity search index
-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_unified_stats_embedding
ON unified_competitive_stats
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 6: Create helper function for semantic search
CREATE OR REPLACE FUNCTION search_campaigns_semantic(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 100
)
RETURNS TABLE (
    id BIGINT,
    category TEXT,
    brand TEXT,
    country TEXT,
    media TEXT,
    channel TEXT,
    budget_numeric NUMERIC,
    volume_numeric BIGINT,
    date TIMESTAMP,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        unified_competitive_stats.id,
        unified_competitive_stats.category,
        unified_competitive_stats.brand,
        unified_competitive_stats.country,
        unified_competitive_stats.media,
        unified_competitive_stats.channel,
        unified_competitive_stats.budget_numeric,
        unified_competitive_stats.volume_numeric,
        unified_competitive_stats.date,
        1 - (unified_competitive_stats.embedding <=> query_embedding) AS similarity
    FROM unified_competitive_stats
    WHERE
        unified_competitive_stats.embedding IS NOT NULL
        AND 1 - (unified_competitive_stats.embedding <=> query_embedding) > match_threshold
    ORDER BY unified_competitive_stats.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 7: Add computed column for searchable text (for embedding generation)
ALTER TABLE unified_competitive_stats
ADD COLUMN IF NOT EXISTS searchable_text TEXT GENERATED ALWAYS AS (
    COALESCE(brand, '') || ' ' ||
    COALESCE(country, '') || ' ' ||
    COALESCE(category, '') || ' ' ||
    COALESCE(media, '') || ' ' ||
    COALESCE(channel, '') || ' ' ||
    COALESCE(TO_CHAR(date, 'YYYY-MM'), '')
) STORED;

-- Step 8: Create index on searchable text for full-text search fallback
CREATE INDEX IF NOT EXISTS idx_unified_stats_searchable_text
ON unified_competitive_stats
USING gin(to_tsvector('english', searchable_text));

-- Step 9: Analyze tables to update statistics for query planner
ANALYZE unified_competitive_stats;

-- ============================================================================
-- NOTES FOR MANUAL EXECUTION:
-- ============================================================================
-- 1. This migration is SAFE - it adds new columns without dropping old ones
-- 2. After verifying budget_numeric and volume_numeric are correct, you can:
--    - Rename columns: ALTER TABLE ... RENAME COLUMN budget TO budget_old;
--    - Rename new: ALTER TABLE ... RENAME COLUMN budget_numeric TO budget;
-- 3. To generate embeddings, run the embedding generation script after this
-- 4. Embedding generation should be done in batches (see utils/embeddings.ts)
-- ============================================================================

-- Verification queries:
-- SELECT budget, budget_numeric FROM unified_competitive_stats WHERE budget_numeric IS NOT NULL LIMIT 10;
-- SELECT COUNT(*) as total, COUNT(budget_numeric) as migrated FROM unified_competitive_stats;
-- SELECT COUNT(*) as total, COUNT(embedding) as has_embedding FROM unified_competitive_stats;
