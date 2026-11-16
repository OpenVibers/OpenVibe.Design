-- phase: expand
-- How exact each glyph draft's geometry is (server/glyphs/geometry.js, 2026-11-16; the owner, on a hand-rounded gear:
-- "completely scuffed … the icon generation system even more improved"): its symmetry scores, the centre offset and
-- what it was meant to keep and did not, and how many points the mirror snap moved. Shown to the reviewer; the
-- candidates of one draw are kept best first.
ALTER TABLE glyph_drafts ADD COLUMN geometry_json jsonb NOT NULL DEFAULT '{}'::jsonb;
