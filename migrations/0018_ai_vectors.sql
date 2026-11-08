-- phase: expand
-- The vectors a person makes with the model (plan R1 item 8, Seven Domains §11).
-- New tables; an older release ignores all of it.
--
-- A vector is one drawing: the SVG the model drew, cleaned before it was stored, and the note the
-- person gave when they asked for it.
CREATE TABLE IF NOT EXISTS ai_vectors (
    id text COLLATE "C" PRIMARY KEY,
    owner text COLLATE "C" NOT NULL,
    prompt text NOT NULL,
    kind text COLLATE "C" NOT NULL DEFAULT 'icon',
    svg text NOT NULL,
    provider text COLLATE "C",
    model text COLLATE "C",
    license text COLLATE "C" NOT NULL DEFAULT 'OFL-1.1',
    state text COLLATE "C" NOT NULL DEFAULT 'drawn',
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_vectors_kind CHECK (kind IN ('icon', 'illustration', 'pattern')),
    CONSTRAINT ai_vectors_state CHECK (state IN ('drawn', 'refused'))
);
CREATE INDEX ai_vectors_owner_created ON ai_vectors (owner, created_at DESC);

-- How many model runs a person may make a day, and how many they have made. The cap is in the
-- config; this is the count it is measured against.
CREATE TABLE IF NOT EXISTS ai_make_runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner text COLLATE "C" NOT NULL,
    kind text COLLATE "C" NOT NULL,
    day date NOT NULL DEFAULT current_date,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_make_runs_kind CHECK (kind IN ('typeface', 'vector'))
);
CREATE INDEX ai_make_runs_owner_day ON ai_make_runs (owner, day);
