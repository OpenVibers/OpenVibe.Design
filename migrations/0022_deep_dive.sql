-- phase: expand
-- "Research first" (owner ask, 2026-11-11): a design can be drawn from a deep dive. The dive is a durable
-- OpenVibe.AI run (workflow design.deep_dive); this table keeps the run's link, its report's numbered points,
-- the brief the generator reads, and the person's own view of it. The design points at it with a plain text id;
-- no foreign key, so a report kept here never blocks a design or a run.
CREATE TABLE IF NOT EXISTS design_research (
    id          text COLLATE "C" PRIMARY KEY,
    owner       text COLLATE "C" NOT NULL,
    question    text NOT NULL,
    depth       text COLLATE "C" NOT NULL DEFAULT 'thorough' CHECK (depth IN ('quick','thorough','expert')),
    sites       jsonb NOT NULL DEFAULT '[]'::jsonb,
    run_id      text COLLATE "C",
    status      text COLLATE "C" NOT NULL DEFAULT 'starting'
                CHECK (status IN ('starting','running','done','failed','cancelled')),
    progress    jsonb NOT NULL DEFAULT '{}'::jsonb,
    report      jsonb,
    points      jsonb NOT NULL DEFAULT '[]'::jsonb,
    brief       text,
    report_url  text,
    estimate    jsonb,
    error       text,
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS design_research_owner_recent ON design_research (owner, created_at DESC, id);
CREATE INDEX IF NOT EXISTS design_research_run ON design_research (run_id) WHERE run_id IS NOT NULL;

-- A rule a report proposes. Nothing enters server/rules/register.js by itself: the owner reads the evidence on
-- /rules and approves or dismisses. Approval opens a pull request against the register; dismissal keeps the row
-- so the same proposal is not offered again.
CREATE TABLE IF NOT EXISTS rule_proposals (
    id          text COLLATE "C" PRIMARY KEY,
    research_id text COLLATE "C" NOT NULL,
    owner       text COLLATE "C" NOT NULL,
    rule        text NOT NULL,
    detail      text NOT NULL DEFAULT '',
    why         text NOT NULL DEFAULT '',
    area        text COLLATE "C" NOT NULL DEFAULT 'products',
    evidence    jsonb NOT NULL DEFAULT '[]'::jsonb,
    state       text COLLATE "C" NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','approved','dismissed')),
    pr_url      text,
    pr_branch   text,
    pr_error    text,
    decided_by  text COLLATE "C",
    decided_at  timestamptz,
    created_at  timestamptz NOT NULL,
    updated_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rule_proposals_state ON rule_proposals (state, created_at DESC);
CREATE INDEX IF NOT EXISTS rule_proposals_research ON rule_proposals (research_id);

ALTER TABLE designs ADD COLUMN IF NOT EXISTS research_id text COLLATE "C";
