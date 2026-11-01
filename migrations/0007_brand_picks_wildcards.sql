-- phase: expand
-- /brand/explore's third kind, the Wildcards (W01–W40; the owner, 2026-11-01: "an option 3… 40 of them"): the codes'
-- check admits W beside L, P, M and F. Replacing a CHECK with a wider one keeps every saved row valid (N-1 safe).
ALTER TABLE brand_picks DROP CONSTRAINT IF EXISTS brand_picks_code_check;
ALTER TABLE brand_picks ADD CONSTRAINT brand_picks_code_check CHECK (code ~ '^[LPMFW](0[1-9]|[1-9][0-9])$');
