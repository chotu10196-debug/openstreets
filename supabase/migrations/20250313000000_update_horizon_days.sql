-- Migration: Update horizon_days constraint from (7, 14) to (1, 5)
-- Created: 2025-03-13

-- 1. Drop the old CHECK constraint first so the UPDATEs are not blocked by it
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_horizon_days_check;

-- 2. Update ALL existing rows (active, resolved, and expired) to the new horizon values
UPDATE predictions SET horizon_days = 5 WHERE horizon_days = 14;
UPDATE predictions SET horizon_days = 5 WHERE horizon_days = 7;

-- 3. Add the new CHECK constraint
ALTER TABLE predictions ADD CONSTRAINT predictions_horizon_days_check CHECK (horizon_days IN (1, 5));
