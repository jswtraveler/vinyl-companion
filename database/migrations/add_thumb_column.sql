-- Add thumb column to albums table for quick thumbs up/down rating
-- Run this in the Supabase SQL Editor for existing deployments

ALTER TABLE albums ADD COLUMN IF NOT EXISTS thumb TEXT CHECK (thumb IN ('up', 'down'));
