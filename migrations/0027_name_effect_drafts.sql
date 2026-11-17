-- phase: expand
-- Name effect drafts ("make me an effect", plan §AD.15): a person describes an effect, a model on Exchange writes it,
-- server/namefx/css.js checks and rebuilds the CSS before it is kept here, and an admin approves or rejects it.
-- Approved ones are public data for Inventory and openvibe-shared (GET /api/v1/name-effects/drafts?status=approved).

CREATE TABLE name_effect_drafts (
    id           text COLLATE "C" PRIMARY KEY,
    subject      text COLLATE "C" NOT NULL,
    slug         text COLLATE "C" NOT NULL,
    label        text NOT NULL DEFAULT '',
    words        text NOT NULL DEFAULT '',
    css          text NOT NULL,
    provider     text COLLATE "C",
    model        text COLLATE "C",
    status       text COLLATE "C" NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
    reviewed_by  text COLLATE "C",
    created_at   timestamptz NOT NULL DEFAULT now(),
    reviewed_at  timestamptz
);
CREATE INDEX name_effect_drafts_status ON name_effect_drafts (status, created_at DESC);
CREATE INDEX name_effect_drafts_subject ON name_effect_drafts (subject, created_at DESC);
