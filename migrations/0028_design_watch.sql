-- phase: expand
-- Watch mode (plan §AD.25 item 12, design CI): every OpenVibe site's home page held to Design's page audit once a day
-- (server/review/watch.js), its latest findings kept per site with the high ones that are new since the check before.
-- /watch shows them, /api/v1/watch serves them. Older releases ignore these tables.
CREATE TABLE IF NOT EXISTS design_watch (
    host        text COLLATE "C" PRIMARY KEY,
    url         text NOT NULL,
    checked_at  timestamptz NOT NULL,
    ok          boolean NOT NULL,
    error       text,
    title       text NOT NULL DEFAULT '',
    findings    jsonb NOT NULL DEFAULT '[]'::jsonb,
    high        integer NOT NULL DEFAULT 0,
    medium      integer NOT NULL DEFAULT 0,
    low         integer NOT NULL DEFAULT 0,
    new_high    jsonb NOT NULL DEFAULT '[]'::jsonb,
    previous_at timestamptz
);
CREATE TABLE IF NOT EXISTS design_watch_state (
    id integer PRIMARY KEY CHECK (id = 1),
    last_success_at timestamptz,
    claimed_until timestamptz,
    claim_id text
);
INSERT INTO design_watch_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
