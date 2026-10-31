-- phase: expand
-- Glyph drafts (plan L32 I3): a person names an icon, OpenVibe.AI draws candidates in the OpenVibe hand, each is
-- checked and rebuilt (server/glyphs/validate.js) before it is kept here, and an admin approves or rejects it.
-- Approved drafts are what openvibe-shared takes into its glyph registry (GET /api/v1/glyphs/drafts?status=approved).

CREATE TABLE glyph_drafts (
    id           text COLLATE "C" PRIMARY KEY,
    subject      text COLLATE "C" NOT NULL,
    name         text COLLATE "C" NOT NULL,
    sentence     text NOT NULL DEFAULT '',
    svg          text NOT NULL,
    provider     text COLLATE "C",
    model        text COLLATE "C",
    status       text COLLATE "C" NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
    reviewed_by  text COLLATE "C",
    created_at   timestamptz NOT NULL DEFAULT now(),
    reviewed_at  timestamptz
);
CREATE INDEX glyph_drafts_status ON glyph_drafts (status, created_at DESC);
CREATE INDEX glyph_drafts_subject ON glyph_drafts (subject, created_at DESC);
