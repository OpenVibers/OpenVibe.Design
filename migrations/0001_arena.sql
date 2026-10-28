-- phase: expand
-- OpenVibe.Design's Arena (plan 2026-10-28 §5.2 v2): one prompt, several models, blind votes and an Elo
-- leaderboard per category. The model's page is stored as text and rendered only in a sandboxed iframe; no
-- column here is a secret. Votes keep the output ids exactly as the voter saw them, never a person's name in
-- the open dataset.

CREATE TABLE arena_rounds (
    id         text COLLATE "C" PRIMARY KEY,                 -- arr_ + ULID
    category   text COLLATE "C" NOT NULL,                    -- landing | dashboard | mobile_app | game_ui | logo | slides
    prompt     text NOT NULL,
    created_by text COLLATE "C" NOT NULL,                    -- usr_…; the person who started the round
    status     text COLLATE "C" NOT NULL DEFAULT 'queued',   -- queued | generating | ready | failed
    offers     jsonb NOT NULL DEFAULT '[]'::jsonb,           -- the {provider, model} slots this round asked AI for
    pool_fallback boolean NOT NULL DEFAULT false,            -- true when fewer than three offers were listed
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT arena_rounds_category CHECK (category IN ('landing', 'dashboard', 'mobile_app', 'game_ui', 'logo', 'slides')),
    CONSTRAINT arena_rounds_status CHECK (status IN ('queued', 'generating', 'ready', 'failed'))
);
CREATE INDEX arena_rounds_status_created ON arena_rounds (status, created_at);
CREATE INDEX arena_rounds_by_creator ON arena_rounds (created_by, created_at);
CREATE INDEX arena_rounds_ready_by_category ON arena_rounds (category, created_at) WHERE status = 'ready';

CREATE TABLE arena_outputs (
    id         text COLLATE "C" PRIMARY KEY,                 -- aro_ + ULID
    round      text COLLATE "C" NOT NULL REFERENCES arena_rounds (id) ON DELETE CASCADE,
    model      text COLLATE "C" NOT NULL,                    -- the model AI reports, e.g. gpt-5-mini
    provider   text COLLATE "C",                             -- the provider AI reports, e.g. shared
    html       text NOT NULL DEFAULT '',                     -- sanitized, at most 200 KB
    cost_usd   numeric(12, 6) NOT NULL DEFAULT 0,            -- what the run reported, in USD
    ms         integer NOT NULL DEFAULT 0,                   -- the generation's measured time
    tokens     integer NOT NULL DEFAULT 0,
    error      text,
    ui_check   jsonb,                                        -- Vision's checks, when it has run
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX arena_outputs_by_round ON arena_outputs (round);
CREATE INDEX arena_outputs_by_model ON arena_outputs (model);

CREATE TABLE arena_votes (
    round          text COLLATE "C" NOT NULL REFERENCES arena_rounds (id) ON DELETE CASCADE,
    voter_subject  text COLLATE "C" NOT NULL,                -- usr_…; never exported or shown
    left_output    text COLLATE "C" NOT NULL REFERENCES arena_outputs (id) ON DELETE CASCADE,
    right_output   text COLLATE "C" NOT NULL REFERENCES arena_outputs (id) ON DELETE CASCADE,
    winner         text COLLATE "C" NOT NULL,                -- left | right | tie | both_bad
    at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (round, voter_subject),
    CONSTRAINT arena_votes_winner CHECK (winner IN ('left', 'right', 'tie', 'both_bad')),
    CONSTRAINT arena_votes_distinct_outputs CHECK (left_output <> right_output)
);
CREATE INDEX arena_votes_by_round ON arena_votes (round);
CREATE INDEX arena_votes_by_voter ON arena_votes (voter_subject, at);

CREATE TABLE arena_ratings (
    category   text COLLATE "C" NOT NULL,
    model      text COLLATE "C" NOT NULL,
    elo        numeric(8, 2) NOT NULL DEFAULT 1000,
    games      integer NOT NULL DEFAULT 0,
    wins       integer NOT NULL DEFAULT 0,
    losses     integer NOT NULL DEFAULT 0,
    ties       integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (category, model),
    CONSTRAINT arena_ratings_category CHECK (category IN ('landing', 'dashboard', 'mobile_app', 'game_ui', 'logo', 'slides')),
    CONSTRAINT arena_ratings_counters CHECK (games >= 0 AND wins >= 0 AND losses >= 0 AND ties >= 0)
);
CREATE INDEX arena_ratings_order ON arena_ratings (category, elo DESC, games DESC);

-- openvibe-sdk/account-data keeps its own idempotency here (ADR-033): a redelivered export or deletion
-- changes nothing. It holds an export_id or deletion_id, the subject and the counts sent to Network.
CREATE TABLE account_data_events (
    id         text PRIMARY KEY,
    kind       text NOT NULL,
    subject    text NOT NULL,
    outcome    jsonb,
    applied_at timestamptz NOT NULL DEFAULT now(),
    sent_at    timestamptz
);
