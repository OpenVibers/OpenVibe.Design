-- phase: expand
-- Public font catalogue and a durable weekly refresh claim. Older releases ignore these tables.
CREATE TABLE IF NOT EXISTS font_families (
    id text COLLATE "C" PRIMARY KEY,
    metadata jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS font_catalog_state (
    id integer PRIMARY KEY CHECK (id = 1),
    last_success_at timestamptz,
    claimed_until timestamptz,
    claim_id text
);
INSERT INTO font_catalog_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
