-- phase: expand
-- Each glyph draft keeps its solid twin (plan L50: the drawing the sites show at 18 px and under), checked by
-- server/glyphs/validate.js cleanSolid. NULL when the model drew none or its solid failed the checks; the line drawing
-- is kept either way.
ALTER TABLE glyph_drafts ADD COLUMN solid_svg text;
