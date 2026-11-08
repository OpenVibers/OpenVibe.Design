-- phase: expand
-- The typefaces a person makes with the model (plan R1 item 8, Seven Domains §11).
-- A new table; an older release ignores it.
--
-- A typeface is the person's: the glyph outlines the model drew, the metrics they were compiled
-- with, and the model that drew them. The binaries are not stored here: they are compiled from the
-- outlines on request, so a redrawn glyph replaces the file rather than adding to it.
CREATE TABLE IF NOT EXISTS ai_typefaces (
    id text COLLATE "C" PRIMARY KEY,
    owner text COLLATE "C" NOT NULL,
    name text COLLATE "C" NOT NULL,
    prompt text NOT NULL,
    base_family text COLLATE "C",
    style_notes text,
    glyphs jsonb NOT NULL DEFAULT '[]'::jsonb,
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    provider text COLLATE "C",
    model text COLLATE "C",
    license text COLLATE "C" NOT NULL DEFAULT 'OFL-1.1',
    state text COLLATE "C" NOT NULL DEFAULT 'drawing',
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_typefaces_glyphs_array CHECK (jsonb_typeof(glyphs) = 'array'),
    CONSTRAINT ai_typefaces_state CHECK (state IN ('drawing', 'ready', 'refused'))
);
CREATE INDEX ai_typefaces_owner_created ON ai_typefaces (owner, created_at DESC);
