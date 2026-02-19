-- Migration: Convert page_number from 0-indexed to 1-indexed
-- Run this BEFORE deploying the updated code.
--
-- Safe because:
--   - No unique constraint on page_number alone
--   - All rows updated uniformly, preserving relative ordering

UPDATE documents SET page_number = page_number + 1;
UPDATE page_extractions SET page_number = page_number + 1;
