-- phase: expand
-- Part B: the chosen working frame, its Arena vote, the per-design AI edit budget and every saved version.
-- The generated JSON variants stay where part A put them; a version is a full HTML document and a pick points at
-- the current one. History is append-only: undo/redo move the pointer, they never delete a version.

CREATE TABLE design_picks (
    design_id          text COLLATE "C" PRIMARY KEY REFERENCES designs (id) ON DELETE CASCADE,
    variant_index      integer NOT NULL,
    variant_id         text COLLATE "C" NOT NULL,
    voter_subject      text COLLATE "C",
    current_seq        integer NOT NULL DEFAULT 1,
    redo_stack         jsonb NOT NULL DEFAULT '[]'::jsonb,
    chat_edits         integer NOT NULL DEFAULT 0,
    bench_round_id     text COLLATE "C",
    bench_left_output  text COLLATE "C",
    bench_right_output text COLLATE "C",
    bench_judgement_id text COLLATE "C",
    vote_state         text COLLATE "C" NOT NULL DEFAULT 'none',
    vote_error         text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT design_picks_variant_index CHECK (variant_index >= 0),
    CONSTRAINT design_picks_current_seq CHECK (current_seq >= 1),
    CONSTRAINT design_picks_chat_edits CHECK (chat_edits >= 0),
    CONSTRAINT design_picks_redo_stack CHECK (jsonb_typeof(redo_stack) = 'array'),
    CONSTRAINT design_picks_vote_state CHECK (vote_state IN ('none', 'guest', 'pending', 'recorded', 'unavailable', 'failed'))
);

CREATE TABLE design_versions (
    design_id     text COLLATE "C" NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
    seq           integer NOT NULL,
    variant_index integer NOT NULL,
    variant_id    text COLLATE "C" NOT NULL,
    kind          text COLLATE "C" NOT NULL,
    html          text NOT NULL,
    instruction   text,
    change        jsonb,
    model         text COLLATE "C",
    provider      text COLLATE "C",
    cost_usd      numeric(12, 6) NOT NULL DEFAULT 0,
    ms            integer NOT NULL DEFAULT 0,
    parent_seq    integer,
    created_by    text COLLATE "C",
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (design_id, seq),
    CONSTRAINT design_versions_seq CHECK (seq >= 1),
    CONSTRAINT design_versions_kind CHECK (kind IN ('generated', 'chat', 'click')),
    CONSTRAINT design_versions_parent CHECK (parent_seq IS NULL OR parent_seq < seq)
);

CREATE INDEX design_versions_by_design ON design_versions (design_id, seq);
