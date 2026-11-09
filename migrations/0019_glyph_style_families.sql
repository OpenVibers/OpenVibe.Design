-- phase: expand
-- Keep the requested style family and the licensed reference cards alongside each reviewed glyph draft.
ALTER TABLE glyph_drafts ADD COLUMN styles_json jsonb NOT NULL DEFAULT '["thin","light","regular","bold","solid","duotone"]'::jsonb;
ALTER TABLE glyph_drafts ADD COLUMN references_json jsonb NOT NULL DEFAULT '[]'::jsonb;
