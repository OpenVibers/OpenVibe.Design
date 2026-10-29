-- phase: expand
-- A design and its independently generated frames live in one row.
CREATE TABLE designs (
    id text COLLATE "C" PRIMARY KEY,
    prompt text NOT NULL,
    kind text COLLATE "C" NOT NULL,
    theme_id text COLLATE "C",
    variants jsonb NOT NULL DEFAULT '[]'::jsonb,
    owner text COLLATE "C",
    guest_hash text,
    guest_ip text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT designs_kind CHECK (kind IN ('page', 'screen', 'component')),
    CONSTRAINT designs_variants_array CHECK (jsonb_typeof(variants) = 'array')
);
CREATE INDEX designs_owner_recent ON designs (owner, created_at DESC);
CREATE INDEX designs_guest_daily ON designs (guest_ip, created_at);
