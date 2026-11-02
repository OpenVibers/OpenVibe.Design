-- phase: expand
-- Publish a design on openvibe.space (open item D8): the Space site a design was published to, its address, and when.
-- Null for every design today; the code before this one never reads them.
ALTER TABLE designs ADD COLUMN IF NOT EXISTS space_site_id text;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS space_url text;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS published_at timestamptz;
