-- phase: expand
-- /brand/explore grew (the owner, 2026-11-01): more takes (L01–L72, P01–P60) and a third step, the name's font
-- (F01–F12). The code check widens to any family letter and 01–99; every code already stored still passes it.

ALTER TABLE brand_picks DROP CONSTRAINT IF EXISTS brand_picks_code_check;
ALTER TABLE brand_picks ADD CONSTRAINT brand_picks_code_check CHECK (code ~ '^[LPMF](0[1-9]|[1-9][0-9])$');
