-- phase: expand
-- /brand/explore picks (the owner, 2026-11-01: "when they choose options it'll save to the server, and that shows at
-- the top of the page what people have picked"). One row per voter and picked code (L01–L50 the Loop, P01–P50 the
-- Pair, M01–M50 the menu button). A voter is a signed-in subject (usr_…), or 'anon:' and a hash of a random key kept
-- in this browser's cookie; the key itself is never stored.

CREATE TABLE brand_picks (
    voter       text COLLATE "C" NOT NULL,
    code        text COLLATE "C" NOT NULL CHECK (code ~ '^[LPM](0[1-9]|[1-4][0-9]|50)$'),
    signed_in   boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (voter, code)
);
CREATE INDEX brand_picks_code ON brand_picks (code);
