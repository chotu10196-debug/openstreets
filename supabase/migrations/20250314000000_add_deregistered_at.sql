-- Migration: Add deregistered_at column to agents table for soft-delete deregistration
-- Created: 2025-03-14

ALTER TABLE agents ADD COLUMN IF NOT EXISTS deregistered_at TIMESTAMPTZ DEFAULT NULL;
