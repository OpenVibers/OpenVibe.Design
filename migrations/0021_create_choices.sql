-- phase: expand
-- A design records the choices it was made with (the create page's modular request): the frame, the look
-- (the theme centre's theme or the person's own), the models asked for, the starting point and the estimate.
-- Every column is nullable and the old page's rows keep working; the kind check is widened, never narrowed.
ALTER TABLE designs ADD COLUMN IF NOT EXISTS frame text COLLATE "C";
ALTER TABLE designs ADD COLUMN IF NOT EXISTS look text COLLATE "C";
ALTER TABLE designs ADD COLUMN IF NOT EXISTS look_variables jsonb;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS models jsonb;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS start jsonb;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS source_design_id text COLLATE "C";
ALTER TABLE designs ADD COLUMN IF NOT EXISTS estimate jsonb;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS thumbnail_svg text;

ALTER TABLE designs DROP CONSTRAINT IF EXISTS designs_kind;
ALTER TABLE designs ADD CONSTRAINT designs_kind
    CHECK (kind IN ('page', 'screen', 'component', 'slide', 'email', 'social-card', 'mark'));

CREATE INDEX IF NOT EXISTS designs_owner_recent_page ON designs (owner, created_at DESC, id);
