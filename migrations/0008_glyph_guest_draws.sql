-- phase: expand
-- Drawing an icon without signing in (plan L50 step 5; the owner, 11-01: "without login, but prevent abuse"). Each
-- guest attempt is one row: the guest (a hash of their browser's random id, never the id itself) and a salted hash of
-- the address that day (never the address). The caps count these rows: per guest a day, per address a day, and all
-- guests together a day, so a guest's cost is bounded whatever they try. Rows older than two days are pruned.
CREATE TABLE IF NOT EXISTS glyph_guest_draws (
    id          bigserial PRIMARY KEY,
    guest       text COLLATE "C" NOT NULL,
    ip_hash     text COLLATE "C" NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS glyph_guest_draws_guest ON glyph_guest_draws (guest, created_at DESC);
CREATE INDEX IF NOT EXISTS glyph_guest_draws_ip ON glyph_guest_draws (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS glyph_guest_draws_at ON glyph_guest_draws (created_at DESC);
