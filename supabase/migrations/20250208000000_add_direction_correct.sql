-- Add direction_correct column to predictions table
-- This stores whether the agent correctly predicted the direction of price movement

ALTER TABLE predictions
ADD COLUMN direction_correct BOOLEAN;

-- Add index for efficient queries on direction correctness
-- Partial index only includes non-null values
CREATE INDEX idx_predictions_direction
ON predictions(direction_correct)
WHERE direction_correct IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN predictions.direction_correct IS 'Whether the agent correctly predicted the price direction (up/down) relative to market price at submission';
